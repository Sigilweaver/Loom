#!/usr/bin/env bash
# convert-tags.sh
# Converts all lightweight tags to annotated tags, preserving the original
# commit and using its date as the tag date.
#
# Usage:
#   1. Review the output of: bash .github/scripts/convert-tags.sh --dry-run
#   2. Run for real:         bash .github/scripts/convert-tags.sh
#   3. Push to remote:       git push origin --tags --force
#
# WARNING: Force-pushing tags will update existing GitHub Releases in-place.
# The release assets and notes are preserved, but the tag object changes.
# This is safe but you should verify your releases page afterward.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
fi

for tag in $(git tag --sort=version:refname); do
    obj_type=$(git cat-file -t "$tag")
    if [[ "$obj_type" == "tag" ]]; then
        echo "SKIP $tag (already annotated)"
        continue
    fi

    commit=$(git rev-list -1 "$tag")
    date=$(git log -1 --format=%aI "$commit")
    subject=$(git log -1 --format=%s "$commit")

    if $DRY_RUN; then
        echo "WOULD CONVERT $tag -> annotated at $commit ($date)"
    else
        git tag -d "$tag" > /dev/null
        GIT_COMMITTER_DATE="$date" git tag -a "$tag" "$commit" \
            -m "Release $tag" \
            -m "$subject"
        echo "CONVERTED $tag -> annotated at $commit ($date)"
    fi
done

if $DRY_RUN; then
    echo ""
    echo "Dry run complete. Run without --dry-run to apply."
else
    echo ""
    echo "Done. Push with: git push origin --tags --force"
fi
