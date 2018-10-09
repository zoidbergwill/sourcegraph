#!/usr/bin/env bash

set -x

function usage() {
    echo "Usage:   ./cherry-pick.sh <commit-range> <prune-dir>"
    echo "Example: ./cherry-pick.sh 9819020b09e28ceebc7fcd11fa990f7a55074c9d..3e91245cd264a08a306670bb75023e3b9752c711 ./enterprise"
}

function pickOne() {
    COMMIT=$1
    PRUNE_DIR=$2
    if [ -z "$COMMIT" ] || [ -z "$PRUNE_DIR" ]; then
        echo "Unexpected error" 1>&2
        exit 1
    fi

    (git cherry-pick $COMMIT 2>/dev/null || true) && rm -rf "$PRUNE_DIR" && git add "$PRUNE_DIR"
    if [ ! -z "$(git status --porcelain | grep -v '^M')" ]; then
        echo "Failed to cherry-pick commit $COMMIT. This script is aborting and leaving the working directory in an intermediate state."
        echo 'You must either `git cherry-pick --abort` OR manually resolve the conflict and run `git cherry-pick --continue`.'
        exit 1
    fi
    git -c core.editor=true cherry-pick --continue 2>/dev/null
}

COMMIT_RANGE=$1
PRUNE_DIR=$2
if [ -z "$COMMIT_RANGE" ] || [ -z "$PRUNE_DIR" ]; then
    usage
    exit 1
fi

COMMITS="$COMMIT_RANGE"
if [[ "$COMMIT_RANGE" == *".."* ]]; then
    COMMITS=$(git rev-list $COMMIT_RANGE)
fi

set -e

for rev in $(echo "$COMMITS"); do
    pickOne $rev $PRUNE_DIR
done
