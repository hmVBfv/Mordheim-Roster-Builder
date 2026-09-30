#!/usr/bin/env bash
# The check at the top of install.sh: it runs as root, so its own files (and
# the directories above them) must not be changeable by anyone but root and
# the account it installs for. Needs root; creates throwaway users and removes
# them again. Run by CI; locally: sudo ops/test/install-guard.sh
#
# Regression (Rob, 30.09.2026): the first run on the Pi refused a fresh clone.
# Raspberry Pi OS, like Debian, gives every user a private group of the same
# name and then the umask 002 – so a clone is group-writable, but only by a
# group nobody else is in. That is as safe as owner-writable and must pass.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
src=$(cd "$(dirname "$0")/.." && pwd)
tag=$$
u=rgu$tag other=rgo$tag
failures=0

cleanup() {
  userdel -r "$u" >/dev/null 2>&1 || true
  userdel -r "$other" >/dev/null 2>&1 || true
  groupdel "$u" >/dev/null 2>&1 || true
}
trap cleanup EXIT

useradd -m -U -s /bin/bash "$u"
useradd -m -U -s /bin/bash "$other"
home=$(getent passwd "$u" | cut -d: -f6)
install -d -o "$u" -g "$u" "$home/server" "$home/server/roster"
printf 'ROSTER_HOST=roster.example.org\nROSTER_LAN_IP=127.0.0.1\nROSTER_MOUNT=/\nROSTER_DATA=/srv/roster-guard-%s\n' "$tag" >"$home/server/roster/site.env"

# a clone as the user makes it with umask 002: directories 775, files 664/775
fresh_clone() {
  rm -rf "$home/src"
  (umask 002 && mkdir -p "$home/src/repo" && cp -r "$src" "$home/src/repo/ops")
  chown -R "$u:$u" "$home/src"
  find "$home/src" -type d -exec chmod 775 {} +
  find "$home/src" -type f -exec chmod g+w,o-w {} +
}

# run install.sh as `sudo` from the user would; it never gets further than
# the docker group check (the test users are not in it)
run() { SUDO_USER=$u ROSTER_AGENT_DIR=${agent:-/mnt/ssd/agent} "$home/src/repo/ops/install.sh" 2>&1 || true; }

expect_guard() { # expect_guard <pass|refuse> <description>
  local out
  out=$(run)
  if grep -qE 'not running files from there as root|inside the agent directory' <<<"$out"; then
    got=refuse
  else
    got=pass
  fi
  if [ "$got" = "$1" ]; then echo "ok - $2"; else echo "FAIL - $2: $out"; failures=$((failures + 1)); fi
}

fresh_clone
expect_guard pass "a fresh clone with the user's private group (umask 002)"

chmod o+w "$home/src/repo/ops/lib/common.sh"
expect_guard refuse "a file anyone can write"

fresh_clone
chmod o+w "$home/src"
expect_guard refuse "a directory above the clone anyone can write"

fresh_clone
usermod -aG "$u" "$other"
expect_guard refuse "the group has another member"
gpasswd -d "$other" "$u" >/dev/null

fresh_clone
chgrp "$other" "$home/src/repo/ops/install.sh"
expect_guard refuse "a group-writable file of another group"

fresh_clone
chown "$other" "$home/src/repo/ops/Caddyfile"
expect_guard refuse "a file owned by someone else"

fresh_clone
chmod -R g-w "$home/src"
expect_guard pass "a clone nobody but the owner can write"

agent=$home expect_guard refuse "a clone inside the agent directory"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "install.sh guard: all checks passed"
