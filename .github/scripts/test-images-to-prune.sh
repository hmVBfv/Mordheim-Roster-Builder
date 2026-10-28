#!/usr/bin/env bash
# Tests of images-to-prune.sh with a made-up package. Run by the CI.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
export NOW=1793000000   # 2026-10-26
old=2026-09-01T00:00:00Z
new=2026-10-25T00:00:00Z
h40=$(printf 'a%.0s' {1..40})
d1=$(printf '1%.0s' {1..64}); d2=$(printf '2%.0s' {1..64}); d3=$(printf '3%.0s' {1..64})

versions=$(cat <<JSON
[
 {"id":1,"name":"sha256:$d1","updated_at":"$old","metadata":{"container":{"tags":["abcdef0","$h40","master"]}}},
 {"id":2,"name":"sha256:$d2","updated_at":"$old","metadata":{"container":{"tags":["1234567"]}}},
 {"id":3,"name":"sha256:$d3","updated_at":"$new","metadata":{"container":{"tags":["7654321"]}}},
 {"id":4,"name":"sha256:s1","updated_at":"$old","metadata":{"container":{"tags":["sha256-$d1.sig"]}}},
 {"id":5,"name":"sha256:s2","updated_at":"$old","metadata":{"container":{"tags":["sha256-$d2.sig"]}}},
 {"id":6,"name":"sha256:u","updated_at":"$old","metadata":{"container":{"tags":[]}}},
 {"id":7,"name":"sha256:m","updated_at":"$old","metadata":{"container":{"tags":["drill-broken"]}}},
 {"id":8,"name":"sha256:n","updated_at":"$old","metadata":{"container":{"tags":["abcdef0-20261003","master-20261003"]}}},
 {"id":9,"name":"sha256:s3","updated_at":"$new","metadata":{"container":{"tags":["sha256-$d3.sig"]}}}
]
JSON
)
got=$(echo "$versions" | "$here/images-to-prune.sh" tagged | cut -d' ' -f1 | sort -n | tr '\n' ' ')
want="2 5 "
[ "$got" = "$want" ] || { echo "images-to-prune: wanted '$want', got '$got'" >&2; exit 1; }

# what stays among the tagged ones: master's build, the drill, the monthly one, the recent branch build and the signatures of those
keep=$(echo "$versions" | "$here/images-to-prune.sh" keep | sort | tr '\n' ' ')
want_keep=$(printf 'sha256:%s sha256:m sha256:n sha256:s1 sha256:s3 sha256:%s ' "$d1" "$d3" | tr ' ' '\n' | sort | tr '\n' ' ')
[ "$keep" = "$want_keep" ] || { echo "images-to-prune keep: wanted '$want_keep', got '$keep'" >&2; exit 1; }

# untagged: only the old ones that no kept image lists
kids=$(mktemp); trap 'rm -f "$kids"' EXIT
printf 'sha256:c1\n' > "$kids"
untagged=$(cat <<JSON
[
 {"id":20,"name":"sha256:c1","updated_at":"$old","metadata":{"container":{"tags":[]}}},
 {"id":21,"name":"sha256:c2","updated_at":"$old","metadata":{"container":{"tags":[]}}},
 {"id":22,"name":"sha256:c3","updated_at":"$new","metadata":{"container":{"tags":[]}}},
 {"id":23,"name":"sha256:t","updated_at":"$old","metadata":{"container":{"tags":["1234567"]}}}
]
JSON
)
gotu=$(echo "$untagged" | "$here/images-to-prune.sh" untagged "$kids" | cut -d' ' -f1 | tr '\n' ' ')
[ "$gotu" = "21 " ] || { echo "images-to-prune untagged: wanted '21 ', got '$gotu'" >&2; exit 1; }
echo "images-to-prune: ok"
