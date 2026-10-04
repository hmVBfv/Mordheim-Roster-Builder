#!/usr/bin/env bash
# End-to-end test of ops/ on a real systemd host (CI, the GitHub runner):
# install.sh, the timers' services, roster-deploy with both kinds of
# rollback, the backup and the restore test with restic, roster-restore,
# the SSD drill and the Fail2Ban jail. The Acceptance of phase 2 repeats this
# on the Pi (docs/operations.md, Stufe 3); here it runs on every push.
#
#   sudo IMAGE=<repo> ops/test/e2e.sh <good tag> <broken tag> <migration-drill tag>
#
# The images must exist locally (roster-deploy runs with ROSTER_NO_PULL=1).
# The SSD is a tmpfs on /srv/ssd, mounted through systemd.
set -Eeuo pipefail

good=${1:?good tag} broken=${2:?broken tag} drill=${3:?migration drill tag}
IMAGE=${IMAGE:-localtest/mordheim-roster}
user=${SUDO_USER:?run with sudo}
[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
home=$(getent passwd "$user" | cut -d: -f6)
ops=$(cd "$(dirname "$0")/.." && pwd)
# not /mnt/ssd: on the runner /mnt is a disk of its own that systemd cannot
# start, so a mount below it fails its dependency. The paths come from
# site.env (ROSTER_MOUNT), as they would on the desktop in an emergency.
mnt=/srv/ssd
root=$mnt/roster
data=$root/data
failures=0
work_dir=$(mktemp -d)

as() { sudo -u "$user" env HOME="$home" ROSTER_NO_PULL=1 ROSTER_DEPLOY_WAIT=30 ROSTER_RESTORE_WAIT=45 "$@"; }
# In GitHub Actions a failure also becomes an annotation, readable without the log.
annotate() { # annotate <level> <title> <text…>
  [ -n "${GITHUB_ACTIONS:-}" ] || return 0
  local text=${*:3}
  text=${text//'%'/'%25'}
  text=${text//$'\n'/'%0A'}
  echo "::$1 title=$2::$text"
}
ok() { echo "ok - $*"; }
bad() { echo "FAIL - $*"; annotate error "ops e2e" "$*"; failures=$((failures + 1)); }
trap 'annotate error "ops e2e aborted" "line $LINENO: $BASH_COMMAND"' ERR
expect() { # expect <description> <command…>
  local d=$1; shift
  if "$@"; then ok "$d"; else bad "$d"; fi
}
expect_exit() { # expect_exit <code> <description> <command…>
  local want=$1 d=$2 got=0; shift 2
  "$@" || got=$?
  if [ "$got" = "$want" ]; then ok "$d (exit $got)"; else bad "$d (exit $got, expected $want)"; fi
}
health() { curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health; }
field() { sed -E "s/.*\"$1\":\"?([^\",}]*)\"?.*/\\1/"; }
probe_set() { docker exec "${2:-roster-app}" node -e "const D=require('/app/node_modules/better-sqlite3');new D('/data/roster.sqlite').prepare(\"INSERT INTO meta (key, value) VALUES ('e2e_probe', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value\").run(process.argv[1])" "$1"; }
probe_get() { docker exec "${1:-roster-app}" node -e "const D=require('/app/node_modules/better-sqlite3');const r=new D('/data/roster.sqlite').prepare(\"SELECT value FROM meta WHERE key = 'e2e_probe'\").get();process.stdout.write(r?r.value:'')"; }
env_tag() { sed -n "s/^$1=//p" "$home/server/roster/.env" | tail -n 1; }
runs_image() { [ "$(docker inspect -f '{{.Image}}' roster-app)" = "$(docker image inspect -f '{{.Id}}' "$IMAGE:$1")" ]; }

echo "# setup"
mkdir -p "$mnt"
# a mount unit, so systemd knows it: the timers' services require the mount
unit=$(systemd-escape --path --suffix=mount "$mnt")
if ! systemctl is-active --quiet "$unit"; then
  printf '[Mount]\nWhat=tmpfs\nWhere=%s\nType=tmpfs\nOptions=size=1g,mode=755\n' "$mnt" >"/run/systemd/system/$unit"
  systemctl daemon-reload
  if ! systemctl start "$unit"; then
    annotate error "mount $mnt" "$(systemctl status "$unit" --no-pager 2>&1 | tail -n 15 || true)"
    exit 1
  fi
fi
for _ in $(seq 1 10); do mountpoint -q "$mnt" && break; sleep 0.5; done
mountpoint -q "$mnt" || { annotate error "mount $mnt" "systemd mounted it, this process does not see it"; exit 1; }
install -d -o "$user" -g "$(id -g "$user")" "$home/server" "$home/server/roster"
cat >"$home/server/roster/site.env" <<EOF
ROSTER_HOST=roster.test
ROSTER_LAN_IP=127.0.0.1
ROSTER_IMAGE=$IMAGE
ROSTER_MOUNT=$mnt
EOF
# install.sh refuses to run files others could have changed, and checks the
# directories above them too (the runner's primary group is not private)
chmod -R go-w "$ops"
d=$(dirname "$ops")
while [ "$d" != / ] && [ "$d" != /home ]; do chmod go-w "$d"; d=$(dirname "$d"); done
"$ops/install.sh" --no-caddy
as sh -c "umask 077; head -c 32 /dev/urandom | base64 > $root/secrets/restic.pass"
as restic init -q -r "$root/backups/restic" --password-file "$root/secrets/restic.pass"
expect "install.sh created the marker file on the (mounted) SSD" test -f "$data/.roster-volume"
expect "app.env is private" test "$(stat -c %a "$root/app.env")" = 600
expect "install.sh gave app.env a TOTP_KEY" grep -Eq '^TOTP_KEY=[A-Za-z0-9+/]{43}=$' "$root/app.env"
expect "staging has a key of its own" sh -c "test \"\$(grep '^TOTP_KEY=' '$root/staging.env')\" != \"\$(grep '^TOTP_KEY=' '$root/app.env')\""
totp_key=$(grep '^TOTP_KEY=' "$root/app.env")
expect "Docker and the timers wait for the SSD" grep -q "RequiresMountsFor=$mnt" /etc/systemd/system/docker.service.d/ssd.conf /etc/systemd/system/roster-backup.service
expect "the timers are enabled" systemctl is-enabled --quiet roster-backup.timer roster-restore-test.timer
expect "roster-alive waits for Stufe 2" sh -c '! systemctl is-enabled --quiet roster-alive.timer'
expect "no DynDNS updater without its settings" test ! -e /etc/systemd/system/porkbun-ddns.timer

echo "# a new hostname: app.env is kept, and install.sh says what to change"
sed -i 's/^ROSTER_HOST=.*/ROSTER_HOST=roster2.test/' "$home/server/roster/site.env"
"$ops/install.sh" --no-caddy 2>"$work_dir/install.err" >/dev/null
expect "app.env keeps its origin" grep -qx 'PUBLIC_ORIGIN=https://roster.test' "$root/app.env"
expect "app.env keeps its TOTP_KEY, once" test "$(grep -c '^TOTP_KEY=' "$root/app.env")" = 1 -a "$(grep '^TOTP_KEY=' "$root/app.env")" = "$totp_key"
expect "install.sh warns that PUBLIC_ORIGIN is stale" grep -q "PUBLIC_ORIGIN is 'https://roster.test', site.env says https://roster2.test" "$work_dir/install.err"
expect "roster.conf has the new hostname" grep -qx 'ROSTER_HOST=roster2.test' /etc/roster/roster.conf
sed -i 's/^ROSTER_HOST=.*/ROSTER_HOST=roster.test/' "$home/server/roster/site.env"
"$ops/install.sh" --no-caddy 2>"$work_dir/install.err" >/dev/null
expect "no warning once they agree" sh -c "! grep -q PUBLIC_ORIGIN '$work_dir/install.err'"

echo "# DynDNS updater: installed only with private settings"
install -m 644 /dev/null /etc/porkbun-ddns.env
# enabling the timer runs the updater at once: a domain without a dot stops
# it before it calls Porkbun
printf 'PORKBUN_API_KEY=pk1_x\nPORKBUN_SECRET_KEY=sk1_x\nDOMAIN=not-a-domain\nHOSTS="mordheim ts"\n' >/etc/porkbun-ddns.env
expect_exit 1 "install.sh refuses keys others can read" sh -c "'$ops/install.sh' --no-caddy >/dev/null 2>&1"
chmod 600 /etc/porkbun-ddns.env
"$ops/install.sh" --no-caddy >/dev/null
expect "the updater is installed" test -x /usr/local/sbin/porkbun-ddns
expect "its timer is enabled" systemctl is-enabled --quiet porkbun-ddns.timer
systemctl disable --now porkbun-ddns.timer >/dev/null 2>&1
rm -f /etc/porkbun-ddns.env /etc/systemd/system/porkbun-ddns.service /etc/systemd/system/porkbun-ddns.timer /usr/local/sbin/porkbun-ddns
systemctl daemon-reload

echo "# first deploy"
expect_exit 0 "roster-deploy $good" as roster-deploy "$good"
expect "health ok" sh -c "curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health | grep -q '\"status\":\"ok\"'"
expect "ROSTER_TAG is $good" test "$(env_tag ROSTER_TAG)" = "$good"
expect "logs go to journald" sh -c "journalctl CONTAINER_NAME=roster-app -n 50 --no-pager | grep -q '\"event\":\"started\"'"
probe_set before-backup

echo "# backup and restore test (the timers' services)"
expect "roster-backup.service" systemctl start roster-backup.service
expect "restic has a snapshot" sh -c "sudo -u $user restic -q -r $root/backups/restic --password-file $root/secrets/restic.pass snapshots --json | grep -q '\"tags\":\\[\"nightly\"\\]'"
probe_set after-backup
expect "roster-restore-test.service" systemctl start roster-restore-test.service
expect "the test instance is healthy" sh -c "curl -fsS -m 5 http://127.0.0.1:8081/api/v1/health | grep -q '\"status\":\"ok\"'"
expect "the test instance holds the backed-up state" test "$(probe_get roster-staging)" = before-backup
expect "production is untouched" test "$(probe_get)" = after-backup

echo "# rollback drill: an image that does not start"
epoch=$(health | field epoch)
schema=$(docker exec roster-app roster-cli schema-version)
expect_exit 1 "roster-deploy $broken is refused" as roster-deploy "$broken"
expect "ROSTER_TAG is back to $good" test "$(env_tag ROSTER_TAG)" = "$good"
expect "the app runs $good again" runs_image "$good"
expect "health ok" sh -c "curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health | grep -q '\"status\":\"ok\"'"
expect "same epoch: the schema did not change, nothing was restored" test "$(health | field epoch)" = "$epoch"
expect "the data is as it was" test "$(probe_get)" = after-backup

echo "# rollback drill: an image that migrates and fails"
expect_exit 1 "roster-deploy $drill is refused" as roster-deploy "$drill"
expect "the app runs $good again" runs_image "$good"
expect "schema back at $schema" test "$(docker exec roster-app roster-cli schema-version)" = "$schema"
expect "the failed database is kept" sh -c "ls $data | grep -q '^roster.sqlite.failed-'"
expect "the data is as before the deploy" test "$(probe_get)" = after-backup
expect "a new epoch: devices sync anew" test "$(health | field epoch)" != "$epoch"

echo "# roster-restore from restic"
expect_exit 0 "roster-restore --yes" as roster-restore --yes
expect "the data is the backed-up state" test "$(probe_get)" = before-backup
expect "the replaced database is kept" sh -c "ls $data | grep -q '^roster.sqlite.before-restore-'"

echo "# the test instance gets a version of its own"
expect_exit 0 "roster-deploy --staging $good" as roster-deploy --staging "$good"
expect "STAGING_TAG is $good" test "$(env_tag STAGING_TAG)" = "$good"
as roster-deploy --status

echo "# SSD drill"
mv "$data/.roster-volume" "$data/.roster-volume.away"
expect_exit 1 "roster-deploy refuses without the marker" as roster-deploy "$good"
expect "roster-backup.service fails without the marker" sh -c '! systemctl start roster-backup.service'
docker restart roster-app >/dev/null
sleep 3
expect "the app does not come up without the marker" sh -c "! curl -fsS -m 3 http://127.0.0.1:3000/api/v1/health"
expect "it says why" sh -c "journalctl CONTAINER_NAME=roster-app -n 50 --no-pager | grep -q volume_missing"
mv "$data/.roster-volume.away" "$data/.roster-volume"
docker restart roster-app >/dev/null
for _ in $(seq 1 20); do health >/dev/null 2>&1 && break; sleep 1; done
expect "back with the marker" sh -c "curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health | grep -q '\"status\":\"ok\"'"

echo "# roster-alive reports what is wrong (no public host in CI)"
expect_exit 1 "roster-alive fails here" as /usr/local/lib/roster/roster-alive

echo "# Fail2Ban"
if systemctl is-active --quiet fail2ban; then
  expect "the jail is active" fail2ban-client status roster-auth
  for i in $(seq 1 12); do
    printf 'CONTAINER_NAME=roster-app\nMESSAGE={"level":"warn","time":"%s","event":"login_failed","ip":"198.51.100.23","account":"x%s","msg":"login failed"}\n' "$(date -u +%FT%TZ)" "$i" |
      logger --journald
  done
  banned=""
  for _ in $(seq 1 20); do
    if fail2ban-client status roster-auth | grep -q 198.51.100.23; then banned=1; break; fi
    sleep 1
  done
  expect "ten failed logins ban the address" test -n "$banned"
  fail2ban-client set roster-auth unbanip 198.51.100.23 >/dev/null 2>&1 || true
else
  bad "fail2ban is not running"
fi

echo "# ops log"
cat "$home/server/roster/ops.log"
echo
if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  annotate notice "ops.log" "$(tail -n 40 "$home/server/roster/ops.log")"
  annotate notice "roster-app journal" "$(journalctl CONTAINER_NAME=roster-app -n 30 --no-pager -o cat 2>&1 | cut -c1-300)"
  for u in roster-backup roster-restore-test; do
    annotate notice "$u journal" "$(journalctl -u "$u.service" -n 30 --no-pager 2>&1 | cut -c1-300)"
  done
  journalctl CONTAINER_NAME=roster-app -n 40 --no-pager || true
  exit 1
fi
echo "all ops checks passed"
