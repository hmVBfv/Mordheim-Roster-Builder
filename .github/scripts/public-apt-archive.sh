#!/bin/bash
# The hosted runners read their Ubuntu packages through a mirror list that points at azure.archive.ubuntu.com. When that host cannot be
# resolved (11.11.2026, for hours) every apt call of the workflow fails, whatever the change is. Point apt at the public archive
# instead and let it retry; the packages are the same.
set -euo pipefail
shopt -s nullglob
for f in /etc/apt/sources.list.d/*.sources /etc/apt/sources.list; do
  sudo sed -i 's|mirror+file:/etc/apt/apt-mirrors.txt|http://archive.ubuntu.com/ubuntu/|g; s|https\?://azure\.archive\.ubuntu\.com/ubuntu/\?|http://archive.ubuntu.com/ubuntu/|g' "$f"
done
echo 'Acquire::Retries "5";' | sudo tee /etc/apt/apt.conf.d/80-retries > /dev/null
grep -h '^URIs:\|^deb ' /etc/apt/sources.list.d/*.sources /etc/apt/sources.list 2>/dev/null | sort -u
