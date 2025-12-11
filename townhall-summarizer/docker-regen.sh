#!/bin/bash

# Docker wrapper for regen-townhalls.sh
# Checks for townhall-video-ids.txt and requires input if not found

cd "$(dirname "$0")"

VIDEO_IDS_FILE="townhall-video-ids.txt"

# If no arguments provided and file doesn't exist, require input
if [ "$#" -eq 0 ] && [ ! -f "$VIDEO_IDS_FILE" ]; then
  echo "⚠️  $VIDEO_IDS_FILE not found"
  echo ""
  echo "Please provide video IDs in one of these ways:"
  echo "  1. Create $VIDEO_IDS_FILE with one video ID per line"
  echo "  2. Pass video IDs as arguments: yarn docker:regen <videoId1> [videoId2] ..."
  echo "  3. Pass a file path: yarn docker:regen <path-to-file>"
  echo ""
  echo "Error: No video IDs provided and $VIDEO_IDS_FILE not found"
  exit 1
fi

# Pass all arguments to regen-townhalls.sh (or none if file exists)
./regen-townhalls.sh "$@"

