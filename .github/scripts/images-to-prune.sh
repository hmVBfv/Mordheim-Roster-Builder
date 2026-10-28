#!/usr/bin/env bash
# images-to-prune – which versions of the container package may go (ADR 0028).
#
#   images-to-prune.sh tagged       < versions.json   the tagged versions to delete
#   images-to-prune.sh keep         < versions.json   the tagged versions that stay (digests, one per line)
#   images-to-prune.sh untagged <children.txt> < versions.json
#                                                      the untagged versions to delete
#
# versions.json is the package's versions as the GitHub API lists them. Prints one line per version:
# "<id> <tags>" (tagged) or "<id> <digest>" (untagged).
#
# Tagged: keeps master's builds (a tag of the whole commit, :master, :master-<date>, :<commit>-<date>
# of the monthly rebuild) and :drill-broken; everything newer than DAYS (14); and the signatures that
# belong to a version that stays (a tag sha256-<digest>.sig). What is left – the builds of branches,
# from the time every branch published one, and their signatures – goes.
# Untagged: the platform images and attestations inside a multi-arch image have no tag of their own.
# One goes only when it is older than DAYS and no image that stays lists it in <children.txt> (the
# digests of the children of every kept tagged version). Without that file nothing untagged is touched.
# Environment: DAYS (14), NOW (epoch seconds, for the tests).
set -euo pipefail

DAYS=${DAYS:-14}
NOW=${NOW:-$(date +%s)}
mode=${1:-tagged}

DEFS='
  def tags: (.metadata.container.tags // []);
  def master_tag: test("^([0-9a-f]{40}|master|drill-broken|master-[0-9]{8}|[0-9a-f]{7}-[0-9]{8})$");
  def sig_of: capture("^sha256-(?<hex>[0-9a-f]{64})\\.(sig|att|sbom)$").hex;
  def recent: ((.updated_at | fromdateiso8601) > ($now - $days * 86400));
  (map(select(tags | any(master_tag)) | .name)) as $kept_names
  | def goes: (tags | length) > 0 and (recent | not) and (tags | any(master_tag) | not)
      and ((tags | map(sig_of? // empty)) as $hex | ($hex | length) == 0 or all($hex[]; . as $h | ($kept_names | index("sha256:" + $h)) == null));
'

case "$mode" in
  tagged) jq -r --argjson days "$DAYS" --argjson now "$NOW" "$DEFS"' .[] | select(goes) | "\(.id) \(tags | join(","))"' ;;
  keep) jq -r --argjson days "$DAYS" --argjson now "$NOW" "$DEFS"' .[] | select((tags | length) > 0 and (goes | not)) | .name' ;;
  untagged)
    children=${2:?children file}
    jq -r --argjson days "$DAYS" --argjson now "$NOW" --rawfile kids "$children" "$DEFS"'
      ($kids | split("\n") | map(select(length > 0))) as $kids
      | .[] | . as $v | select(($v | (tags | length) == 0 and (recent | not)) and (($kids | index($v.name)) == null))
      | "\(.id) \(.name)"' ;;
  *) echo "images-to-prune: unknown mode $mode" >&2; exit 2 ;;
esac
