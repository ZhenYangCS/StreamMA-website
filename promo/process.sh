#!/bin/bash
# Transcode raw.webm -> streamma_promo.mp4 (1080p H.264, Twitter-friendly).
# Captions are already baked into raw.webm by the Playwright recorder.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

INPUT="raw.webm"
OUTPUT="streamma_promo.mp4"

if [ ! -f "$INPUT" ]; then
  echo "[process] missing $INPUT — run record.py first."
  exit 1
fi

echo "[process] encoding -> $OUTPUT"
ffmpeg -y -i "$INPUT" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -an \
  "$OUTPUT"

SIZE=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT")
SIZE_MB=$(echo "scale=2; $SIZE/1048576" | bc)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT" | head -1)
echo "[process] done -> $OUTPUT  (${SIZE_MB} MB, ${DUR}s)"
