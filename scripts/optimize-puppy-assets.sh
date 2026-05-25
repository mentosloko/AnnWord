#!/usr/bin/env bash
set -euo pipefail

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 'magick' is required. Install it first." >&2
  exit 1
fi

if ! command -v cwebp >/dev/null 2>&1; then
  echo "WebP encoder 'cwebp' is required. Install webp tools first." >&2
  exit 1
fi

optimize_transparent_character() {
  local src="$1"
  local dst="$2"
  local tmp
  tmp="$(mktemp --suffix=.png)"

  magick "$src" \
    -alpha on \
    -trim +repage \
    -resize '680x680>' \
    -background none \
    -gravity south \
    -extent 768x768 \
    "$tmp"

  cwebp -quiet -q 84 -alpha_q 95 "$tmp" -o "$dst"
  rm -f "$tmp"
}

optimize_transparent_icon() {
  local src="$1"
  local dst="$2"
  local tmp
  tmp="$(mktemp --suffix=.png)"

  magick "$src" \
    -alpha on \
    -trim +repage \
    -resize '220x220>' \
    -background none \
    -gravity center \
    -extent 256x256 \
    "$tmp"

  cwebp -quiet -q 84 -alpha_q 95 "$tmp" -o "$dst"
  rm -f "$tmp"
}

optimize_background() {
  local src="$1"
  local dst="$2"
  local tmp
  tmp="$(mktemp --suffix=.png)"

  magick "$src" -resize '1600x900>' "$tmp"
  cwebp -quiet -q 80 "$tmp" -o "$dst"
  rm -f "$tmp"
}

optimize_transparent_character \
  public/assets/pets/puppy/base/idle.png \
  public/assets/pets/puppy/base/idle.webp

for src in public/assets/pets/puppy/with-accessories/*.png; do
  [ -e "$src" ] || continue
  optimize_transparent_character "$src" "${src%.png}.webp"
done

if [ -d public/assets/items/treats ]; then
  for src in public/assets/items/treats/*.png; do
    [ -e "$src" ] || continue
    optimize_transparent_icon "$src" "${src%.png}.webp"
  done
fi

if [ -f public/assets/rooms/puppy/background.webp ]; then
  optimize_background \
    public/assets/rooms/puppy/background.webp \
    public/assets/rooms/puppy/background.webp
fi

find public/assets/pets/puppy public/assets/items/treats public/assets/rooms/puppy \
  -type f \( -name '*.webp' -o -name '*.png' \) \
  -exec du -h {} + | sort -h
