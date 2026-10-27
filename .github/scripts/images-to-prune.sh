#!/usr/bin/env bash
# images-to-prune – which versions of the container package may go (ADR 0028).
#
#   images-to-prune.sh < versions.json      (the package's versions, as the GitHub API lists them)
#
# Prints one line per version to delete: <id> <tags or "-">. Keeps, always: master's builds (a tag
# of the whole commit, :master, :master-<date>, :<commit>-<date> of the monthly rebuild) and
# :drill-broken; everything newer than DAYS (14); untagged versions (the platform images inside a
# multi-arch image: deleting them would break the one that is kept); and the signatures that belong
# to a version that stays (a tag sha256-<digest>.sig). What is left – the builds of branches, from
# the time every branch published one, and the signatures of those – goes.
# Environment: DAYS (14), NOW (epoch seconds, for the tests).
set -euo pipefail

DAYS=${DAYS:-14}
NOW=${NOW:-$(date +%s)}

jq -r --argjson days "$DAYS" --argjson now "$NOW" '
  def tags: (.metadata.container.tags // []);
  def master_tag: test("^([0-9a-f]{40}|master|drill-broken|master-[0-9]{8}|[0-9a-f]{7}-[0-9]{8})$");
  def sig_of: capture("^sha256-(?<hex>[0-9a-f]{64})\\.(sig|att|sbom)$").hex;
  def recent: ((.updated_at | fromdateiso8601) > ($now - $days * 86400));
  (map(select(tags | any(master_tag)) | .name) ) as $kept_names
  | .[]
  | select((tags | length) > 0)
  | select(recent | not)
  | select(tags | any(master_tag) | not)
  | select(
      (tags | map(sig_of? // empty) | length) == 0
      or ((tags | map(sig_of? // empty)) as $hex | all($hex[]; . as $h | ($kept_names | index("sha256:" + $h)) == null))
    )
  | "\(.id) \(tags | join(","))"
' 
