#!/usr/bin/env bash
# cleanup-covers.sh — Clean old album covers by song ID
# Usage: bash scripts/cleanup-covers.sh [--dry-run]
#
# Compares cover files in public/uploads/covers/ against the active
# cloudMusicIds in both blog/ and my-blog-manager/ siteConfig.ts files.
# Deletes covers not referenced by any active song ID.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[DRY RUN] No files will be deleted."
fi

# ---- Collect all active song IDs from both siteConfigs ----
ACTIVE_IDS=""

for cfg in "$ROOT_DIR/blog/siteConfig.ts" "$ROOT_DIR/my-blog-manager/siteConfig.ts"; do
  if [[ -f "$cfg" ]]; then
    # Extract cloudMusicIds array entries
    ids=$(grep -oP '(?<=")\d{3,}(?=")' "$cfg" 2>/dev/null || true)
    ACTIVE_IDS+="$ids"$'\n'
  fi
done

ACTIVE_IDS=$(echo "$ACTIVE_IDS" | sort -u | sed '/^$/d')
echo "Active song IDs from siteConfig: $(echo "$ACTIVE_IDS" | wc -l | tr -d ' ')"

# ---- Scan cover directories ----
COVER_DIRS=(
  "$ROOT_DIR/blog/public/uploads/covers"
  "$ROOT_DIR/my-blog-manager/public/uploads/covers"
)

TOTAL_SIZE=0
DELETED=0
KEPT=0

for cover_dir in "${COVER_DIRS[@]}"; do
  if [[ ! -d "$cover_dir" ]]; then
    echo "  [skip] $cover_dir (does not exist)"
    continue
  fi

  echo ""
  echo "Scanning: $cover_dir"

  for cover_file in "$cover_dir"/*; do
    [[ -f "$cover_file" ]] || continue

    filename=$(basename "$cover_file")
    # Extract song ID: filename format is {id}.{ext} e.g. 3355479289.jpg
    song_id="${filename%%.*}"

    # Validate it looks like a numeric song ID
    if [[ ! "$song_id" =~ ^[0-9]{3,}$ ]]; then
      echo "  [warn] Skipping non-ID file: $filename"
      continue
    fi

    file_size=$(stat -c%s "$cover_file" 2>/dev/null || stat -f%z "$cover_file" 2>/dev/null || echo 0)
    size_kb=$((file_size / 1024))

    if echo "$ACTIVE_IDS" | grep -qxF "$song_id"; then
      echo "  [keep] $filename (${size_kb}KB) — active song"
      KEPT=$((KEPT + 1))
    else
      echo "  [DEL]  $filename (${size_kb}KB) — ID $song_id not in any siteConfig"
      if [[ "$DRY_RUN" == false ]]; then
        rm -f "$cover_file"
      fi
      TOTAL_SIZE=$((TOTAL_SIZE + file_size))
      DELETED=$((DELETED + 1))
    fi
  done
done

echo ""
echo "============================================"
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY RUN] Would delete $DELETED files ($((TOTAL_SIZE / 1024)) KB)"
else
  echo "Deleted $DELETED files ($((TOTAL_SIZE / 1024)) KB freed)"
fi
echo "Kept $KEPT active covers"
echo "============================================"
