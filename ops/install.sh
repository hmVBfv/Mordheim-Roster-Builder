#!/usr/bin/env bash
# ops/install.sh – puts the Pi's configuration from the repository in place
# (ADR 0015, docs/operations.md). On the Pi, in your own clone – never in one
# an agent container can write to, because this script runs as root:
#
#   cd ~/src/Mordheim-Roster-Builder && git pull --ff-only && sudo ops/install.sh
#
# Reads ~/server/roster/site.env (hostname, LAN IP; see ops/site.env.example)
# and writes:
#   ~/server/roster/compose.yaml, Caddyfile, .env (if missing)
#   /mnt/ssd/roster/{data,uploads,backups,secrets,caddy,staging}/, the marker
#     file (only on the mounted SSD), app.env, staging.env and
#     secrets/healthchecks.env (only if missing – never overwritten)
#   /etc/roster/roster.conf, /usr/local/bin/roster-{deploy,restore},
#     /usr/local/lib/roster/, systemd units and timers, the Docker drop-in
#     that waits for the SSD, the Fail2Ban filter and jail
#   /usr/local/sbin/porkbun-ddns and its timer, only if /etc/porkbun-ddns.env
#     exists (the domain's DynDNS, ops/env/porkbun-ddns.env.example)
# then starts Caddy and the backup and restore-test timers. roster-alive is
# enabled by hand in Stufe 2. Safe to run again after every git pull.
#
#   ops/install.sh --render <dir> [--site <site.env>]
#       only render the templates into <dir> (no root, nothing installed)
#   --no-caddy   do not start or restart Caddy (CI)
set -euo pipefail

ops=$(cd "$(dirname "$0")" && pwd)
render_only="" site="" no_caddy=""
while [ $# -gt 0 ]; do
  case "$1" in
    --render) render_only=${2:?--render needs a directory}; shift 2 ;;
    --site) site=${2:?--site needs a file}; shift 2 ;;
    --no-caddy) no_caddy=1; shift ;;
    *) echo "usage: sudo $0 [--no-caddy] | $0 --render <dir> [--site <file>]" >&2; exit 64 ;;
  esac
done

say() { echo "install: $*"; }
warn() { echo "install: WARNING: $*" >&2; }
die() { echo "install: ERROR: $*" >&2; exit 1; }

# who and where
if [ -n "$render_only" ]; then
  ROSTER_USER=${ROSTER_USER:-$(id -un)}
else
  [ "$(id -u)" -eq 0 ] || die "run with sudo (or use --render <dir>)"
  if [ -z "${SUDO_USER:-}" ] || [ "$SUDO_USER" = root ]; then die "run it with sudo from your own account, not as root"; fi
  ROSTER_USER=$SUDO_USER
fi
home=$(getent passwd "$ROSTER_USER" | cut -d: -f6) || die "no user $ROSTER_USER"
site=${site:-$home/server/roster/site.env}
[ -r "$site" ] || die "$site is missing – copy ops/site.env.example there and fill it in"

# site.env is read, not run: only these keys, one KEY=value per line
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%$'\r'}
  case "$line" in '' | '#'*) continue ;; esac
  key=${line%%=*} value=${line#*=}
  [ "$key" != "$line" ] || die "site.env: not KEY=value: $line"
  value=${value#\"} value=${value%\"}
  case "$key" in
    ROSTER_HOST | ROSTER_LAN_IP | ROSTER_USER | ROSTER_MOUNT | ROSTER_DATA | ROSTER_IMAGE) printf -v "$key" '%s' "$value" ;;
    *) die "site.env: unknown key $key" ;;
  esac
done <"$site"
[[ "$ROSTER_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || die "ROSTER_USER is not a user name: $ROSTER_USER"
home=$(getent passwd "$ROSTER_USER" | cut -d: -f6) || die "no user $ROSTER_USER (site.env)"
ROSTER_MOUNT=${ROSTER_MOUNT:-/mnt/ssd}
ROSTER_DATA=${ROSTER_DATA:-$ROSTER_MOUNT/roster}
ROSTER_IMAGE=${ROSTER_IMAGE:-ghcr.io/hmvbfv/mordheim-roster}
ROSTER_DIR=$home/server/roster
ROSTER_UID=$(id -u "$ROSTER_USER")
ROSTER_GID=$(id -g "$ROSTER_USER")
: "${ROSTER_HOST:?site.env: ROSTER_HOST is missing}" "${ROSTER_LAN_IP:?site.env: ROSTER_LAN_IP is missing}"
[[ "$ROSTER_HOST" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || die "ROSTER_HOST is not a host name: $ROSTER_HOST"
[[ "$ROSTER_LAN_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die "ROSTER_LAN_IP is not an IPv4 address: $ROSTER_LAN_IP"
[[ "$ROSTER_MOUNT" =~ ^/[A-Za-z0-9/_.-]*$ ]] || die "ROSTER_MOUNT is not a plain absolute path: $ROSTER_MOUNT"
[[ "$ROSTER_DATA" =~ ^/[A-Za-z0-9/_.-]+$ ]] || die "ROSTER_DATA is not a plain absolute path: $ROSTER_DATA"
case "$ROSTER_DATA/" in "${ROSTER_MOUNT%/}/"?*) ;; *) die "ROSTER_DATA ($ROSTER_DATA) is not on ROSTER_MOUNT ($ROSTER_MOUNT)" ;; esac
[[ "$ROSTER_IMAGE" =~ ^[a-z0-9./:_-]+$ ]] || die "ROSTER_IMAGE is not an image name: $ROSTER_IMAGE"

render() {
  sed -e "s|{{ROSTER_HOST}}|$ROSTER_HOST|g" -e "s|{{ROSTER_LAN_IP}}|$ROSTER_LAN_IP|g" \
    -e "s|{{ROSTER_DATA}}|$ROSTER_DATA|g" -e "s|{{ROSTER_MOUNT}}|$ROSTER_MOUNT|g" -e "s|{{ROSTER_USER}}|$ROSTER_USER|g" \
    -e "s|{{ROSTER_UID}}|$ROSTER_UID|g" -e "s|{{ROSTER_GID}}|$ROSTER_GID|g" "$1"
}

conf() {
  cat <<EOF
# written by ops/install.sh from $site – do not edit, run install.sh again
ROSTER_USER=$ROSTER_USER
ROSTER_DIR=$ROSTER_DIR
ROSTER_DATA=$ROSTER_DATA
ROSTER_IMAGE=$ROSTER_IMAGE
ROSTER_HOST=$ROSTER_HOST
ROSTER_LAN_IP=$ROSTER_LAN_IP
EOF
}

UNITS=(roster-backup.service roster-backup.timer roster-restore-test.service roster-restore-test.timer roster-alive.service roster-alive.timer)

if [ -n "$render_only" ]; then
  mkdir -p "$render_only/systemd"
  render "$ops/compose.yaml" >"$render_only/compose.yaml"
  render "$ops/Caddyfile" >"$render_only/Caddyfile"
  conf >"$render_only/roster.conf"
  for u in "${UNITS[@]}"; do render "$ops/systemd/$u" >"$render_only/systemd/$u"; done
  render "$ops/systemd/docker.service.d/ssd.conf" >"$render_only/systemd/docker-ssd.conf"
  if grep -rn '{{' "$render_only"; then die "placeholders left unrendered"; fi
  say "rendered into $render_only"
  exit 0
fi

# 0. this script runs as root: its files, and the directories above them,
#    must not be changeable by anyone but root and $ROSTER_USER – in
#    particular not by an agent container (/mnt/ssd/agent is mounted there)
case "$ops/" in "${ROSTER_AGENT_DIR:-/mnt/ssd/agent}"/*) die "$ops is inside the agent directory; clone the repository into your home (docs/operations.md, Stufe 1)" ;; esac
# Debian and Raspberry Pi OS give each user a private group of the same name
# and the umask 002, so a fresh clone is group-writable. Group write counts as
# safe only for that group: nobody else is a member or has it as primary group.
gid=$(id -g "$ROSTER_USER")
private_group=""
if [ "$(getent group "$gid" | cut -d: -f1)" = "$ROSTER_USER" ] &&
  [ -z "$(getent group "$gid" | cut -d: -f4 | tr ',' '\n' | grep -vx "$ROSTER_USER" || true)" ] &&
  [ "$(getent passwd | awk -F: -v g="$gid" '$4 == g' | wc -l)" -eq 1 ]; then
  private_group=1
fi
changeable() { # the files and directories below $1 that someone else could change
  if [ -n "$private_group" ]; then
    find "$1" "${@:2}" \( -perm /002 -o \( -perm /020 ! -group "$gid" \) -o \( ! -user root ! -user "$ROSTER_USER" \) \) -print -quit
  else
    find "$1" "${@:2}" \( -perm /022 -o \( ! -user root ! -user "$ROSTER_USER" \) \) -print -quit
  fi
}
unsafe=$(changeable "$ops")
dir=$(dirname "$ops")
while [ -z "$unsafe" ] && [ "$dir" != / ]; do
  # a directory above: whoever can write it can swap the clone
  unsafe=$(changeable "$dir" -maxdepth 0)
  dir=$(dirname "$dir")
done
[ -z "$unsafe" ] || die "$unsafe ($(stat -c '%A %U:%G' "$unsafe")) can be changed by someone else; not running files from there as root"

# 1. what must be there
for cmd in docker restic curl openssl flock systemctl sed; do
  command -v "$cmd" >/dev/null || die "$cmd is not installed (restic: sudo apt install restic)"
done
docker compose version >/dev/null 2>&1 || die "the docker compose plugin is missing"
id -nG "$ROSTER_USER" | tr ' ' '\n' | grep -qx docker || die "$ROSTER_USER is not in the docker group"
if docker info 2>&1 | grep -qi 'no memory limit support\|memory limit.*not supported'; then
  warn "Docker has no memory limits: add 'cgroup_enable=memory cgroup_memory=1' to /boot/firmware/cmdline.txt and reboot (Stufe 1)"
fi
mountpoint -q "$ROSTER_MOUNT" || die "$ROSTER_MOUNT is not mounted – not installing onto the SD card"

# 2. directories on the SSD
as_user() { install -d -o "$ROSTER_USER" -g "$ROSTER_GID" -m "${2:-750}" "$1"; }
for d in "$ROSTER_DATA" "$ROSTER_DATA/data" "$ROSTER_DATA/uploads" "$ROSTER_DATA/backups" \
  "$ROSTER_DATA/caddy" "$ROSTER_DATA/caddy/data" "$ROSTER_DATA/caddy/config" \
  "$ROSTER_DATA/staging" "$ROSTER_DATA/staging/data" "$ROSTER_DATA/staging/uploads"; do
  as_user "$d"
done
as_user "$ROSTER_DATA/secrets" 700
for m in "$ROSTER_DATA/data/.roster-volume" "$ROSTER_DATA/staging/data/.roster-volume"; do
  if [ ! -f "$m" ]; then
    install -o "$ROSTER_USER" -g "$ROSTER_GID" -m 644 /dev/null "$m"
    say "created the marker file $m"
  fi
done

# 3. files that hold settings or secrets: only if missing
new_file() { # <target> <template> <mode>
  if [ -e "$1" ]; then return 0; fi
  render "$2" >"$1"
  chown "$ROSTER_USER:$ROSTER_GID" "$1"
  chmod "$3" "$1"
  say "created $1"
}
new_file "$ROSTER_DATA/app.env" "$ops/env/app.env.example" 600
new_file "$ROSTER_DATA/staging.env" "$ops/env/staging.env.example" 600
if [ ! -e "$ROSTER_DATA/secrets/healthchecks.env" ]; then
  printf 'HC_ALIVE=\nHC_BACKUP=\nHC_RESTORE_TEST=\n' >"$ROSTER_DATA/secrets/healthchecks.env"
  chown "$ROSTER_USER:$ROSTER_GID" "$ROSTER_DATA/secrets/healthchecks.env"
  chmod 600 "$ROSTER_DATA/secrets/healthchecks.env"
  say "created $ROSTER_DATA/secrets/healthchecks.env – put the three ping URLs in"
fi
# app.env and staging.env are never overwritten: after a new ROSTER_HOST (or
# LAN IP) their origin is stale, and the app refuses writes from the new one
origin_check() { # <file> <expected origin>
  local have
  have=$(sed -n 's/^PUBLIC_ORIGIN=//p' "$1" | tail -n 1)
  have=${have%$'\r'} have=${have#\"} have=${have%\"} have=${have%/}
  if [ "$have" != "$2" ]; then
    warn "$1: PUBLIC_ORIGIN is '$have', site.env says $2 – change it there (sudo nano $1), then: cd $ROSTER_DIR && docker compose up -d --force-recreate $3"
  fi
}
origin_check "$ROSTER_DATA/app.env" "https://$ROSTER_HOST" app
origin_check "$ROSTER_DATA/staging.env" "http://$ROSTER_LAN_IP:8081" staging
[ -f "$ROSTER_DATA/secrets/restic.pass" ] || warn "$ROSTER_DATA/secrets/restic.pass is missing – backups will fail (Stufe 1: restic)"
[ -f "$ROSTER_DATA/backups/restic/config" ] || warn "no restic repository in $ROSTER_DATA/backups/restic – run: restic init -r $ROSTER_DATA/backups/restic --password-file $ROSTER_DATA/secrets/restic.pass"

# 4. compose project
install -d -o "$ROSTER_USER" -g "$ROSTER_GID" -m 755 "$ROSTER_DIR"
old_caddy=$(sha256sum "$ROSTER_DIR/Caddyfile" 2>/dev/null | cut -d' ' -f1 || true)
for f in compose.yaml Caddyfile; do
  render "$ops/$f" >"$ROSTER_DIR/$f.new"
  chown "$ROSTER_USER:$ROSTER_GID" "$ROSTER_DIR/$f.new"
  chmod 644 "$ROSTER_DIR/$f.new"
  mv "$ROSTER_DIR/$f.new" "$ROSTER_DIR/$f"
done
if [ ! -f "$ROSTER_DIR/.env" ]; then
  printf 'ROSTER_IMAGE=%s\n' "$ROSTER_IMAGE" >"$ROSTER_DIR/.env"
  chown "$ROSTER_USER:$ROSTER_GID" "$ROSTER_DIR/.env"
elif ! grep -q '^ROSTER_IMAGE=' "$ROSTER_DIR/.env"; then
  printf 'ROSTER_IMAGE=%s\n' "$ROSTER_IMAGE" >>"$ROSTER_DIR/.env"
fi
touch "$ROSTER_DIR/ops.log" && chown "$ROSTER_USER:$ROSTER_GID" "$ROSTER_DIR/ops.log"

# 5. scripts and their configuration
install -d -m 755 /etc/roster /usr/local/lib/roster
conf >/etc/roster/roster.conf
chmod 644 /etc/roster/roster.conf
install -m 755 "$ops/bin/roster-deploy" "$ops/bin/roster-restore" /usr/local/bin/
install -m 644 "$ops/lib/common.sh" /usr/local/lib/roster/
install -m 755 "$ops/lib/roster-backup" "$ops/lib/roster-restore-test" "$ops/lib/roster-alive" /usr/local/lib/roster/

# 6. systemd
for u in "${UNITS[@]}"; do
  render "$ops/systemd/$u" >"/etc/systemd/system/$u"
  chmod 644 "/etc/systemd/system/$u"
done
install -d -m 755 /etc/systemd/system/docker.service.d
render "$ops/systemd/docker.service.d/ssd.conf" >/etc/systemd/system/docker.service.d/ssd.conf
chmod 644 /etc/systemd/system/docker.service.d/ssd.conf
systemctl daemon-reload
systemctl enable --now roster-backup.timer roster-restore-test.timer >/dev/null
if systemctl is-enabled --quiet roster-alive.timer; then
  say "roster-alive.timer is enabled"
else
  say "roster-alive.timer is installed, not enabled (Stufe 2: sudo systemctl enable --now roster-alive.timer)"
fi

# 6b. DynDNS for the domain (optional): only where its settings exist
ddns_env=/etc/porkbun-ddns.env
if [ -e "$ddns_env" ]; then
  [ "$(stat -c '%u' "$ddns_env")" = 0 ] && [ $((0$(stat -c '%a' "$ddns_env") & 077)) -eq 0 ] ||
    die "$ddns_env ($(stat -c '%A %U' "$ddns_env")) holds the Porkbun keys: sudo chown root: $ddns_env && sudo chmod 600 $ddns_env"
  command -v jq >/dev/null || die "jq is not installed (sudo apt install jq) – the DynDNS updater needs it"
  install -m 755 "$ops/ddns/porkbun-ddns" /usr/local/sbin/porkbun-ddns
  for u in porkbun-ddns.service porkbun-ddns.timer; do install -m 644 "$ops/systemd/$u" "/etc/systemd/system/$u"; done
  systemctl daemon-reload
  systemctl enable --now porkbun-ddns.timer >/dev/null
  say "DynDNS updater enabled (journalctl -u porkbun-ddns)"
fi

# 7. Fail2Ban
if [ -d /etc/fail2ban ]; then
  install -m 644 "$ops/fail2ban/filter.d/roster-auth.conf" /etc/fail2ban/filter.d/roster-auth.conf
  install -m 644 "$ops/fail2ban/jail.d/roster.local" /etc/fail2ban/jail.d/roster.local
  if systemctl is-active --quiet fail2ban; then
    if fail2ban-client reload >/dev/null; then
      say "Fail2Ban reloaded (sudo fail2ban-client status roster-auth)"
    else
      warn "fail2ban-client reload failed – see: sudo journalctl -u fail2ban -n 30"
    fi
  else
    warn "Fail2Ban is installed but not running (sudo systemctl enable --now fail2ban)"
  fi
else
  warn "Fail2Ban is not installed; the roster-auth jail is skipped"
fi

# 8. Caddy (the app itself only ever starts through roster-deploy)
if [ -z "$no_caddy" ]; then
  new_caddy=$(sha256sum "$ROSTER_DIR/Caddyfile" | cut -d' ' -f1)
  cd "$ROSTER_DIR"
  if [ "$(docker inspect -f '{{.State.Running}}' roster-caddy 2>/dev/null)" = true ]; then
    if [ "$old_caddy" != "$new_caddy" ]; then
      docker compose restart caddy >/dev/null && say "Caddy restarted with the new Caddyfile"
    fi
  else
    docker compose up -d caddy >/dev/null && say "Caddy started"
  fi
fi

say "done. Next: roster-deploy <tag> as $ROSTER_USER (roster-deploy --status shows what runs)."
