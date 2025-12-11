#!/bin/bash

# Script to delete and regenerate townhall summaries
# Usage:
#   ./regen-townhalls.sh [video-id-file]
#   ./regen-townhalls.sh townhall-video-ids.txt
#   ./regen-townhalls.sh <videoId1> [videoId2] ...
#
# If no arguments provided, reads from townhall-video-ids.txt
# Order: bottom to top (last ID in list = first video chronologically)
# Runs in Docker using docker-compose

cd "$(dirname "$0")"

VIDEO_IDS_FILE="${1:-townhall-video-ids.txt}"

# Check if first argument is a file or video IDs
if [ -f "$VIDEO_IDS_FILE" ] && [ "$#" -eq 1 ]; then
  # Read video IDs from file
  VIDEO_IDS=$(cat "$VIDEO_IDS_FILE" | grep -v '^#' | grep -v '^$' | tr '\n' ' ')
  if [ -z "$VIDEO_IDS" ]; then
    echo "Error: No video IDs found in $VIDEO_IDS_FILE"
    exit 1
  fi
  echo "Reading video IDs from: $VIDEO_IDS_FILE"
elif [ "$#" -gt 0 ]; then
  # Use provided video IDs as arguments
  VIDEO_IDS="$@"
  echo "Using provided video IDs"
else
  # Default to townhall-video-ids.txt
  if [ ! -f "$VIDEO_IDS_FILE" ]; then
    echo "Error: $VIDEO_IDS_FILE not found and no video IDs provided"
    echo ""
    echo "Usage:"
    echo "  ./regen-townhalls.sh [video-id-file]"
    echo "  ./regen-townhalls.sh <videoId1> [videoId2] ..."
    exit 1
  fi
  VIDEO_IDS=$(cat "$VIDEO_IDS_FILE" | grep -v '^#' | grep -v '^$' | tr '\n' ' ')
fi

VIDEO_COUNT=$(echo $VIDEO_IDS | wc -w | tr -d ' ')
echo "Found $VIDEO_COUNT video ID(s)"
echo ""

# Reverse the order (bottom to top = last ID is first video)
REVERSED_IDS=""
for id in $VIDEO_IDS; do
  REVERSED_IDS="$id $REVERSED_IDS"
done
REVERSED_IDS=$(echo $REVERSED_IDS | sed 's/[[:space:]]*$//')

# Convert to URLs for retro command
RETRO_URLS=""
for id in $REVERSED_IDS; do
  RETRO_URLS="$RETRO_URLS https://www.youtube.com/watch?v=$id"
done

echo "Building Docker image..."
docker-compose --profile retro build retro

echo ""
echo "=========================================="
echo "Step 1: Deleting all existing broadcasts"
echo "=========================================="
echo ""

docker-compose --profile retro run --rm retro yarn delete-broadcast $VIDEO_IDS

if [ $? -ne 0 ]; then
  echo ""
  echo "⚠️  Warning: Some deletions may have failed. Continuing anyway..."
fi

echo ""
echo "=========================================="
echo "Step 2: Regenerating summaries (bottom to top order)"
echo "=========================================="
echo ""

docker-compose --profile retro run --rm retro yarn retro $RETRO_URLS

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="

