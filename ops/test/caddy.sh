#!/usr/bin/env bash
# Caddy as compose.yaml runs it: hardened (read-only, no capabilities but
# NET_BIND_SERVICE, no-new-privileges, its directories root's) it still
# starts and answers on 443, sends the headers of docs/security.md, and keeps
# a Content-Security-Policy the app set itself (security review OPS-4,
# OPS-5). The Caddyfile is install.sh's, with a local certificate instead of
# Let's Encrypt and a stand-in for the app on 127.0.0.1:18080.
# Needs docker with the compose plugin, root (the directories), port 443 free.
# Run by CI: sudo ops/test/caddy.sh
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
src=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
data=$work/roster
failures=0
expect() { # expect <what> <command...>
  if "${@:2}"; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    [ -z "${GITHUB_ACTIONS:-}" ] || echo "::error title=caddy.sh::$1"
    failures=$((failures + 1))
  fi
}
compose() { docker compose --project-directory "$work/r" -f "$work/r/compose.yaml" "$@"; }
cleanup() {
  compose down >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

printf 'ROSTER_HOST=roster.test\nROSTER_LAN_IP=127.0.0.1\nROSTER_MOUNT=%s\nROSTER_DATA=%s\n' "$work" "$data" >"$work/site.env"
"$src/install.sh" --render "$work/r" --site "$work/site.env" >/dev/null

# the same Caddyfile, but a local certificate and the stand-in behind it
awk '
  /^\tadmin off$/ { print; print "\tskip_install_trust"; next }
  /^\ttls \{$/ { print "\ttls internal"; skip = 1; next }
  skip && /^\t\}$/ { skip = 0; next }
  skip { next }
  { sub(/reverse_proxy 127\.0\.0\.1:3000/, "reverse_proxy 127.0.0.1:18080"); print }
' "$work/r/Caddyfile" >"$work/Caddyfile"
cat >>"$work/Caddyfile" <<'EOF'

# any host: reverse_proxy passes the visitor's Host (roster.test) on
http://:18080 {
	handle /picture {
		header Content-Security-Policy "default-src 'none'; img-src 'self'; sandbox"
		respond "picture"
	}
	respond "page"
}
EOF
mv "$work/Caddyfile" "$work/r/Caddyfile"
if ! grep -q 'tls internal' "$work/r/Caddyfile" || ! grep -q 'reverse_proxy 127.0.0.1:18080' "$work/r/Caddyfile"; then
  echo "could not adapt the Caddyfile" >&2
  exit 1
fi

# as install.sh leaves them: Caddy's directories root's, 700
install -d -m 750 "$data"
for d in "$data/caddy" "$data/caddy/data" "$data/caddy/config"; do install -d -o root -g root -m 700 "$d"; done
touch "$data/app.env" "$data/staging.env"
compose up -d --no-deps caddy >/dev/null

# straight to the local Caddy, past any proxy of the machine
get() { curl -sk --noproxy '*' -m 5 --resolve roster.test:443:127.0.0.1 -D "$work/headers" -o "$work/body" "https://roster.test$1"; }
for _ in $(seq 1 30); do get / && break; sleep 1; done
expect "Caddy answers on 443 with its hardening" grep -qx page "$work/body"
expect "  and the headers of docs/security.md" grep -qi '^strict-transport-security: max-age=31536000' "$work/headers"
expect "  its CSP where the app sets none" grep -qi "^content-security-policy: default-src 'self'; script-src 'self'" "$work/headers"
expect "  no Server header" sh -c "! grep -qi '^server:' '$work/headers'"
get /picture || true
expect "the app's own CSP stays (sandbox)" grep -qi "^content-security-policy: default-src 'none'; img-src 'self'; sandbox" "$work/headers"
expect "  and is the only one" test "$(grep -ci '^content-security-policy:' "$work/headers")" = 1
docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}} {{.HostConfig.CapAdd}} {{.HostConfig.SecurityOpt}}' roster-caddy >"$work/inspect"
expect "read-only, only NET_BIND_SERVICE, no-new-privileges" grep -Eqx 'true \[(CAP_)?ALL\] \[(CAP_)?NET_BIND_SERVICE\] \[no-new-privileges:true\]' "$work/inspect"
expect "what Caddy wrote is root's" test -z "$(find "$data/caddy" ! -user root -print -quit)"
expect "  and it wrote its certificate" test -n "$(find "$data/caddy/data" -name '*.crt' -print -quit)"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  [ -z "${GITHUB_ACTIONS:-}" ] || echo "::error title=caddy.sh log::$(compose logs caddy 2>&1 | tail -n 8 | tr '\n' ' ' | cut -c1-900)"
  compose logs caddy | tail -n 30 || true
  exit 1
fi
echo "Caddy: all checks passed"
