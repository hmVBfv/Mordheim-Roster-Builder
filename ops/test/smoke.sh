#!/usr/bin/env bash
# Smoke test of a built image, run by CI before anything is pushed:
#   ops/test/smoke.sh <image> <expected version>
# 1. the SSD drill: without the marker file the container exits, creates nothing
# 2. with it: health is ok and reports the expected version
# 3. roster-cli backup writes a snapshot; the healthcheck script agrees
# 4. accounts: roster-cli makes the admin link, the account registers, sets
#    up the authenticator (TOTP_KEY), a wrong password is turned away and
#    logged for Fail2Ban, a write from elsewhere is refused; a player's
#    warband is stored and synced, a broken save refused
# 5. X-Forwarded-For from the Docker gateway is believed (Fail2Ban sees clients)
# 6. a restart keeps the epoch; a start on a restored snapshot changes it
# 7. memory stays well inside the Pi's 256 MB limit
set -euo pipefail

image=${1:?usage: smoke.sh <image> <version>}
version=${2:?usage: smoke.sh <image> <version>}
port=39123
work=$(mktemp -d)
name=roster-smoke-$$
uid=$(id -u) gid=$(id -g)
origin=http://127.0.0.1:$port
totp_key=$(head -c 32 /dev/urandom | base64)

cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "SMOKE FAILED: $*" >&2; docker logs "$name" 2>&1 | tail -20 >&2 || true; exit 1; }

health() { curl -fsS -m 5 "http://127.0.0.1:$port/api/v1/health"; }

run() {
  docker run -d --name "$name" --user "$uid:$gid" --read-only --tmpfs /tmp --cap-drop ALL \
    --security-opt no-new-privileges:true -p "127.0.0.1:$port:3000" \
    -e PUBLIC_ORIGIN="$origin" -e TOTP_KEY="$totp_key" \
    -v "$work/data:/data" -v "$work/uploads:/uploads" "$image" >/dev/null
}

wait_healthy() {
  for _ in $(seq 1 30); do
    if body=$(health 2>/dev/null) && grep -q '"status":"ok"' <<<"$body"; then echo "$body"; return 0; fi
    sleep 1
  done
  return 1
}

mkdir -p "$work/data" "$work/uploads"

echo "1. without the marker file"
run
for _ in $(seq 1 20); do
  [ "$(docker inspect -f '{{.State.Running}}' "$name")" = false ] && break
  sleep 0.5
done
[ "$(docker inspect -f '{{.State.Running}}' "$name")" = false ] || fail "still running without the marker"
[ "$(docker inspect -f '{{.State.ExitCode}}' "$name")" != 0 ] || fail "exit code 0 without the marker"
docker logs "$name" 2>&1 | grep -q '"event":"volume_missing"' || fail "no volume_missing log line"
[ -z "$(ls -A "$work/data")" ] || fail "created files without the marker: $(ls -A "$work/data")"
docker rm -f "$name" >/dev/null

echo "2. with the marker file"
touch "$work/data/.roster-volume"
run
body=$(wait_healthy) || fail "not healthy within 30 s"
grep -q "\"version\":\"$version\"" <<<"$body" || fail "version is not $version: $body"
grep -q '"migrations":{"current":\([0-9]*\),"expected":\1}' <<<"$body" || fail "migrations not current: $body"
epoch=$(sed -E 's/.*"epoch":"([^"]+)".*/\1/' <<<"$body")
[ -n "$epoch" ] || fail "no epoch"
curl -fsS -m 5 -H 'Accept: text/html' "http://127.0.0.1:$port/" | grep -qi '<!doctype html>' || fail "the app is not served"

echo "3. roster-cli and the healthcheck"
snap=$(docker exec "$name" roster-cli backup --label smoke)
[[ "$snap" =~ ^[0-9]{8}T[0-9]{6}Z-smoke\.sqlite$ ]] || fail "unexpected snapshot name: $snap"
[ -f "$work/data/snapshots/$snap" ] || fail "snapshot not on the volume"
[ "$(docker exec "$name" roster-cli schema-version)" -ge 1 ] || fail "schema-version"
docker exec "$name" node server/dist/healthcheck.js || fail "healthcheck.js says unhealthy"

echo "4. accounts"
api() { curl -sS -m 10 -H 'Content-Type: application/json' -H "Origin: $origin" "$@"; }
link=$(docker exec "$name" roster-cli invite --admin --note smoke)
[[ "$link" =~ ^http://127\.0\.0\.1:$port/invite#[A-Za-z0-9_-]{43}$ ]] || fail "unexpected invite link: $link"
token=${link#*#}
api -c "$work/cookies" -d "{\"token\":\"$token\",\"username\":\"smoke\",\"password\":\"a long test passphrase\"}" \
  "$origin/api/v1/invites/accept" | grep -q '"mustSetUpTotp":true' || fail "registering from the admin link"
api -b "$work/cookies" -d '{}' "$origin/api/v1/account/totp/setup" | grep -q '"uri":"otpauth://totp/' || fail "no authenticator setup (TOTP_KEY)"
[ "$(api -o /dev/null -w '%{http_code}' -d '{"username":"smoke","password":"wrong password!"}' "$origin/api/v1/auth/login")" = 401 ] ||
  fail "a wrong password was not turned away"
sleep 0.5
docker logs "$name" 2>&1 | grep '"event":"login_failed"' | grep -q '"account":"smoke"' || fail "no login_failed line for Fail2Ban"
[ "$(curl -sS -o /dev/null -w '%{http_code}' -m 5 -H 'Content-Type: application/json' -H 'Origin: https://evil.example' \
  -d '{"username":"smoke","password":"x"}' "$origin/api/v1/auth/login")" = 403 ] || fail "a write from another origin was not refused"
docker exec "$name" roster-cli users | grep -q $'^smoke\tadmin\t' || fail "roster-cli users does not list the admin"
# a player's warband: core's save schema and zod are in the image
link=$(docker exec "$name" roster-cli invite --note player)
api -c "$work/player" -d "{\"token\":\"${link#*#}\",\"username\":\"player\",\"password\":\"a long test passphrase\"}" \
  "$origin/api/v1/invites/accept" >/dev/null || fail "registering a player"
wid=$(cat /proc/sys/kernel/random/uuid)
api -b "$work/player" -d "{\"id\":\"$wid\",\"source\":\"save\",\"data\":{\"wb\":\"reikland\",\"name\":\"Smoke\",\"models\":[]}}" \
  "$origin/api/v1/warbands" | grep -q '"headRev":1' || fail "a warband was not stored"
api -b "$work/player" "$origin/api/v1/sync?cursor=0" | grep -q "\"id\":\"$wid\"" || fail "sync does not return the warband"
[ "$(api -b "$work/player" -o /dev/null -w '%{http_code}' -d '{"id":"'"$(cat /proc/sys/kernel/random/uuid)"'","source":"save","data":{"name":"no type"}}' "$origin/api/v1/warbands")" = 400 ] ||
  fail "a save without a warband type was stored"

echo "5. the client address behind the proxy"
curl -s -o /dev/null -m 5 -H 'X-Forwarded-For: 203.0.113.9' "http://127.0.0.1:$port/api/v1/nope"
sleep 0.5
docker logs "$name" 2>&1 | grep '"route":"/api/v1/nope"' | grep -q '"ip":"203.0.113.9"' || fail "X-Forwarded-For from the gateway not believed"

echo "6. the epoch"
docker restart "$name" >/dev/null
body=$(wait_healthy) || fail "not healthy after restart"
grep -q "\"epoch\":\"$epoch\"" <<<"$body" || fail "a restart changed the epoch"
docker stop "$name" >/dev/null
cp "$work/data/snapshots/$snap" "$work/data/roster.sqlite"
rm -f "$work/data/roster.sqlite-wal" "$work/data/roster.sqlite-shm"
docker start "$name" >/dev/null
body=$(wait_healthy) || fail "not healthy on the restored snapshot"
grep -q "\"epoch\":\"$epoch\"" <<<"$body" && fail "a restore kept the epoch"
docker logs "$name" 2>&1 | grep -q '"event":"restored"' || fail "no restored log line"

echo "7. memory"
mem=$(docker stats --no-stream --format '{{.MemUsage}}' "$name" | awk '{print $1}')
echo "   memory in use: $mem"
mib=$(awk -v m="$mem" 'BEGIN { v = m + 0; if (m ~ /GiB/) v *= 1024; else if (m ~ /KiB/) v /= 1024; print int(v) }')
[ "$mib" -lt 160 ] || fail "uses $mem, the budget is 50-80 MB (limit 256 MB)"

echo "smoke test passed"
