#!/usr/bin/env sh
# Installs everything the repo needs. Safe to run again.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 (see README, Requirements)" >&2; exit 1; }; }
need node; need npm; need python3

echo "== npm dependencies (r3f)"
( cd "$ROOT/r3f" && npm ci --no-audit --no-fund )

echo "== numpy for Blender's glTF exporter (kept inside the repo)"
python3 -m pip install --quiet --upgrade --target "$ROOT/cinematic/blender/.pylibs" numpy

echo "== smoke check"
node --version
python3 -c "import sys; print('python', sys.version.split()[0])"
if command -v blender >/dev/null 2>&1; then blender --version | head -1; else echo "blender not found: only needed to rebuild 3D assets"; fi
echo "done. Next: python3 -m http.server 8765  (see README)"
