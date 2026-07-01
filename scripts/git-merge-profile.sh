#!/bin/sh
# Git merge driver: regenerate profile artifacts instead of line-merging.
ROOT="$(git rev-parse --show-toplevel)"
LOCK="$ROOT/.git/profile-sync-merge.lock"

if [ -f "$LOCK" ]; then
  exit 0
fi

touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT

cd "$ROOT" || exit 1
node scripts/sync-profile.mjs || exit 1
exit 0
