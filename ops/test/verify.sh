#!/usr/bin/env bash
# ops/lib/roster-verify with stand-ins for docker and cosign: what it asks
# cosign, and when it refuses – no digest, no commit, another commit than the
# tag asked for, no signature. The real signature is checked by CI after every
# publish (ci.yml, job publish). No root, no network. Locally: ops/test/verify.sh
set -euo pipefail

src=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0
expect() { # expect <what> <command...>
  if "${@:2}"; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}

SHA=0123456789abcdef0123456789abcdef01234567
DIGEST=sha256:$(printf 'a%.0s' $(seq 64))
mkdir "$work/bin"
# docker image inspect -f <template> <ref>: RepoDigests and Config.Env from files
cat >"$work/bin/docker" <<'SH'
#!/usr/bin/env bash
[ "$1 $2" = "image inspect" ] || exit 9
[ -f "$FAKE/exists" ] || exit 1
case "$4" in
  *RepoDigests*) cat "$FAKE/digests" ;;
  *Config.Env*) cat "$FAKE/env" ;;
  *) exit 9 ;;
esac
SH
# cosign verify …: records its arguments, answers as told
cat >"$work/bin/cosign" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" >"$FAKE/cosign-args"
if [ -f "$FAKE/signed" ]; then echo '[{"critical":{}}]'; exit 0; fi
echo "Error: no matching signatures: none of the expected identities matched" >&2
exit 1
SH
chmod +x "$work/bin/docker" "$work/bin/cosign"
export FAKE=$work PATH="$work/bin:$PATH"

image() { # image <digests> <ROSTER_VERSION> [signed] [drill]
  rm -f "$work/signed" "$work/cosign-args"
  touch "$work/exists"
  printf '%s\n' "$1" >"$work/digests"
  printf 'PATH=/usr/local/bin\nROSTER_VERSION=%s\nNODE_ENV=production\n' "$2" >"$work/env"
  [ "${4:-}" != drill ] || echo 'ROSTER_DRILL=broken' >>"$work/env"
  [ "${3:-}" != signed ] || touch "$work/signed"
}
verify() { "$src/lib/roster-verify" "$@" >"$work/out" 2>"$work/err"; }
code() { local c=0; verify "$@" || c=$?; echo "$c"; }
arg_after() { awk -v f="$1" 'p { print; exit } $0 == f { p = 1 }' "$work/cosign-args"; }

R=ghcr.io/hmvbfv/mordheim-roster
image "$R@$DIGEST" "$SHA" signed
expect "a signed master image passes" verify "$R:0123456" 0123456
expect "it prints the digest it verified" test "$(cat "$work/out")" = "$R@$DIGEST"
expect "cosign checks the digest, not the tag" test "$(tail -n 1 "$work/cosign-args")" = "$R@$DIGEST"
# owner and repository in any case (GitHub's names are), the workflow and the branch exactly: a branch "Master" is not master
expect "only master's ci.yml of this repository signs" test "$(arg_after --certificate-identity-regexp)" = '^(?i:https://github\.com/hmvbfv/mordheim-roster-builder)/\.github/workflows/ci\.yml@refs/heads/master$'
expect "through GitHub's OIDC" test "$(arg_after --certificate-oidc-issuer)" = https://token.actions.githubusercontent.com
expect "for the commit the image names" test "$(arg_after --certificate-github-workflow-sha)" = "$SHA"
expect "  repository and branch once more, compared exactly by cosign" test "$(arg_after --certificate-github-workflow-repository) $(arg_after --certificate-github-workflow-ref)" = "hmVBfv/Mordheim-Roster-Builder refs/heads/master"
expect "the full commit as tag passes" verify "$R:$SHA" "$SHA"
expect "the monthly rebuild of a commit passes" verify "$R:0123456-20261103" 0123456-20261103
# a name moves: a branch can point it at an older signed build (independent review)
expect "a name instead of a commit (master) is refused" test "$(code "$R:master" master)" = 1
expect "  it says to name the commit" grep -q 'not a commit' "$work/err"
image "$R@$DIGEST" "$SHA" signed drill
expect "the drill image under a commit's tag is refused" test "$(code "$R:0123456" 0123456)" = 1
expect "the drill image as drill-broken passes (roster-deploy drill-broken)" verify "$R:drill-broken" drill-broken
image "$R@$DIGEST" "$SHA" signed
expect "a release under the drill's name is refused (the drill would deploy it)" test "$(code "$R:drill-broken" drill-broken)" = 1

image "$R@$DIGEST" "$SHA"
expect "unsigned (a branch, or someone else): refused" test "$(code "$R:0123456" 0123456)" = 1
expect "it says why" grep -q "no signature from master's CI" "$work/err"

image "$R@$DIGEST" "$SHA" signed
expect "another commit than asked for: refused" test "$(code "$R:fedcba9" fedcba9)" = 1
expect "it names both" grep -q "you asked for fedcba9, but it was built from $SHA" "$work/err"
expect "cosign was not even asked" test ! -f "$work/cosign-args"

image "" "$SHA" signed
expect "built on this machine (no digest): refused" test "$(code "$R:0123456" 0123456)" = 1
image "other.example/x@$DIGEST" "$SHA" signed
expect "a digest from another repository does not count" test "$(code "$R:0123456" 0123456)" = 1

image "$R@$DIGEST" dev signed
expect "no commit in the image: refused" test "$(code "$R:0123456" 0123456)" = 1

rm -f "$work/exists"
expect "not pulled: exit 2" test "$(code "$R:0123456" 0123456)" = 2
expect "no arguments: exit 2" test "$(code)" = 2

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "roster-verify: all checks passed"
