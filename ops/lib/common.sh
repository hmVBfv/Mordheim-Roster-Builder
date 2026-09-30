# Shared by roster-deploy, roster-backup, roster-restore-test, roster-alive and
# roster-restore. Sourced, not run. Configuration comes from roster.conf,
# written by ops/install.sh from ~/server/roster/site.env:
#   ROSTER_USER ROSTER_DIR ROSTER_DATA ROSTER_IMAGE ROSTER_HOST ROSTER_LAN_IP
# shellcheck shell=bash

ROSTER_CONF=${ROSTER_CONF:-/etc/roster/roster.conf}
if [ ! -r "$ROSTER_CONF" ]; then
  echo "$(basename "$0"): $ROSTER_CONF is missing - run sudo ops/install.sh first" >&2
  exit 1
fi
# shellcheck source=/dev/null
. "$ROSTER_CONF"
: "${ROSTER_DIR:?} ${ROSTER_DATA:?} ${ROSTER_IMAGE:?}"

ROSTER_ENV="$ROSTER_DIR/.env"
ROSTER_LOG="$ROSTER_DIR/ops.log"
HC_ENV="$ROSTER_DATA/secrets/healthchecks.env"
RESTIC_REPO="$ROSTER_DATA/backups/restic"
RESTIC_PASS="$ROSTER_DATA/secrets/restic.pass"
MARKER="$ROSTER_DATA/data/.roster-volume"

log() {
  local line
  line="$(date -u +%Y-%m-%dT%H:%M:%SZ) $(basename "$0"): $*"
  echo "$line" >&2
  echo "$line" >>"$ROSTER_LOG" 2>/dev/null || true
}

die() {
  log "ERROR: $*"
  exit 1
}

# The marker file on the SSD: without it, /mnt/ssd is not mounted.
require_marker() {
  [ -f "$MARKER" ] || die "$MARKER is missing: is the SSD mounted? Nothing was changed."
}

compose() {
  docker compose --project-directory "$ROSTER_DIR" -f "$ROSTER_DIR/compose.yaml" --env-file "$ROSTER_ENV" "$@"
}

# .env holds ROSTER_TAG, PREVIOUS_TAG, STAGING_TAG and ROSTER_IMAGE.
env_get() {
  [ -f "$ROSTER_ENV" ] || return 0
  sed -n "s/^$1=//p" "$ROSTER_ENV" | tail -n 1
}

env_set() {
  local key=$1 value=$2 tmp
  touch "$ROSTER_ENV"
  tmp=$(mktemp "$ROSTER_ENV.XXXXXX")
  grep -v "^$key=" "$ROSTER_ENV" >"$tmp" || true
  echo "$key=$value" >>"$tmp"
  chmod 644 "$tmp"
  mv "$tmp" "$ROSTER_ENV"
}

valid_tag() {
  [[ "$1" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]
}

# A label roster-cli accepts: lower case, digits, . _ -
snapshot_label() {
  local l
  l=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9._-' '-')
  printf '%.64s' "$l"
}

running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = true ]
}

# ROSTER_NO_PULL=1: use an image that is already there (tests with local builds)
pull_image() {
  if [ "${ROSTER_NO_PULL:-}" = 1 ]; then
    image_id "$1" >/dev/null
  else
    docker pull -q "$1" >/dev/null
  fi
}

image_id() {
  docker image inspect -f '{{.Id}}' "$1" 2>/dev/null
}

# wait_healthy <container> <image id> <seconds>: the container runs that image
# and its health endpoint says ok.
wait_healthy() {
  local c=$1 want=$2 secs=$3 i
  for ((i = 0; i < secs; i += 2)); do
    if running "$c" && [ "$(docker inspect -f '{{.Image}}' "$c" 2>/dev/null)" = "$want" ] &&
      docker exec "$c" node server/dist/healthcheck.js >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# healthchecks.io: hc_ping <ALIVE|BACKUP|RESTORE_TEST> [start|fail] [message]
# The URLs live in secrets/healthchecks.env (HC_ALIVE=https://hc-ping.com/…).
hc_ping() {
  local which=$1 suffix=${2:-} msg=${3:-} url
  [ -r "$HC_ENV" ] || return 0
  url=$(sed -n "s/^HC_$which=//p" "$HC_ENV" | tail -n 1)
  [ -n "$url" ] || return 0
  [ -n "$suffix" ] && url="$url/$suffix"
  curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$msg" "$url" || log "ping to healthchecks.io failed ($which $suffix)"
}

restic_cmd() {
  restic -r "$RESTIC_REPO" --password-file "$RESTIC_PASS" "$@"
}
