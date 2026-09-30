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
# /mnt/ssd becomes a tmpfs if it is not a mount point.
set -euo pipefail

good=${1:?good tag} broken=${2:?broken tag} drill=${3:?migration drill tag}
IMAGE=${IMAGE:-localtest/mordheim-roster}
user=${SUDO_USER:?run with sudo}
[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
home=$(getent passwd "$user" | cut -d: -f6)
ops=$(cd "$(dirname "$0")/.." && pwd)
data=/mnt/ssd/roster/data
failures=0

as() { sudo -u "$user" env ROSTER_NO_PULL=1 ROSTER_DEPLOY_WAIT=30 ROSTER_RESTORE_WAIT=45 "$@"; }
ok() { echo "ok - $*"; }
bad() { echo "FAIL - $*"; failures=$((failures + 1)); }
expect() { # expect <description> <command…>
  local d=$1; shift
  if "$@"; then ok "$d"; else bad "$d"; fi
}
expect_exit() { # expect_exit <code> <description> <command…>
  local want=$1 d=$2 got=0; shift 2
  "$@" || got=$?
  if [ "$got" = "$want" ]; then ok "$d (exit $got)"; else bad "$d (exit $got, expected $want)"; fi
}
health() { curl -fsS -m 5 "http://127.0.0.1:${1:-3000}/api/v1/health"; }
field() { sed -E "s/.*\"$1\":\"?([^\",}]*)\"?.*/\\1/"; }
probe_set() { docker exec "${2:-roster-app}" node -e "const D=require('/app/node_modules/better-sqlite3');new D('/data/roster.sqlite').prepare(\"INSERT INTO meta (key, value) VALUES ('e2e_probe', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value\").run(process.argv[1])" "$1"; }
probe_get() { docker exec "${1:-roster-app}" node -e "const D=require('/app/node_modules/better-sqlite3');const r=new D('/data/roster.sqlite').prepare(\"SELECT value FROM meta WHERE key = 'e2e_probe'\").get();process.stdout.write(r?r.value:'')"; }
env_tag() { sed -n "s/^$1=//p" "$home/server/roster/.env" | tail -n 1; }
runs_image() { [ "$(docker inspect -f '{{.Image}}' roster-app)" = "$(docker image inspect -f '{{.Id}}' "$IMAGE:$1")" ]; }

echo "# setup"
mkdir -p /mnt/ssd
mountpoint -q /mnt/ssd || mount -t tmpfs -o size=1g tmpfs /mnt/ssd
install -d -o "$user" -g "$(id -g "$user")" "$home/server" "$home/server/roster"
cat >"$home/server/roster/site.env" <<EOF
ROSTER_HOST=roster.test
ROSTER_LAN_IP=127.0.0.1
ROSTER_IMAGE=$IMAGE
EOF
"$ops/install.sh" --no-caddy
as sh -c 'umask 077; head -c 32 /dev/urandom | base64 > /mnt/ssd/roster/secrets/restic.pass'
as restic init -q -r /mnt/ssd/roster/backups/restic --password-file /mnt/ssd/roster/secrets/restic.pass
expect "install.sh created the marker file on the (mounted) SSD" test -f "$data/.roster-volume"
expect "app.env is private" test "$(stat -c %a /mnt/ssd/roster/app.env)" = 600
expect "the timers are enabled" systemctl is-enabled --quiet roster-backup.timer roster-restore-test.timer
expect "roster-alive waits for Stufe 2" sh -c '! systemctl is-enabled --quiet roster-alive.timer'

echo "# first deploy"
expect_exit 0 "roster-deploy $good" as roster-deploy "$good"
expect "health ok" sh -c "curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health | grep -q '\"status\":\"ok\"'"
expect "ROSTER_TAG is $good" test "$(env_tag ROSTER_TAG)" = "$good"
expect "logs go to journald" sh -c "journalctl CONTAINER_NAME=roster-app -n 50 --no-pager | grep -q '\"event\":\"started\"'"
probe_set before-backup

echo "# backup and restore test (the timers' services)"
expect "roster-backup.service" systemctl start roster-backup.service
expect "restic has a snapshot" sh -c "sudo -u $user restic -q -r /mnt/ssd/roster/backups/restic --password-file /mnt/ssd/roster/secrets/restic.pass snapshots --json | grep -q '\"tags\":\\[\"nightly\"\\]'"
probe_set after-backup
expect "roster-restore-test.service" systemctl start roster-restore-test.service
expect "the test instance is healthy" sh -c "curl -fsS -m 5 http://127.0.0.1:8081/api/v1/health | grep -q '\"status\":\"ok\"'"
expect "the test instance holds the backed-up state" test "$(probe_get roster-staging)" = before-backup
expect "production is untouched" test "$(probe_get)" = after-backup

echo "# rollback drill: an image that does not start"
epoch=$(health | field epoch)
expect_exit 1 "roster-deploy $broken is refused" as roster-deploy "$broken"
expect "ROSTER_TAG is back to $good" test "$(env_tag ROSTER_TAG)" = "$good"
expect "the app runs $good again" runs_image "$good"
expect "health ok" sh -c "curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health | grep -q '\"status\":\"ok\"'"
expect "same epoch: the schema did not change, nothing was restored" test "$(health | field epoch)" = "$epoch"
expect "the data is as it was" test "$(probe_get)" = after-backup

echo "# rollback drill: an image that migrates and fails"
expect_exit 1 "roster-deploy $drill is refused" as roster-deploy "$drill"
expect "the app runs $good again" runs_image "$good"
expect "schema back at 1" test "$(docker exec roster-app roster-cli schema-version)" = 1
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
  journalctl CONTAINER_NAME=roster-app -n 40 --no-pager || true
  exit 1
fi
echo "all ops checks passed"
