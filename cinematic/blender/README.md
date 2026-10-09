# Blender build

`blender -b -P build_mansion.py` writes `mansion.blend` here and `../world3d/models/mansion/mansion.glb`.
Flags: `-- --quick` (no pines), `-- --no-export`. Tested on Blender 4.0.2 (4.2+ also works).

The glTF exporter needs numpy, which the distro Blender's Python lacks. Either `sudo apt install python3-numpy`, or
`pip install --target .pylibs numpy` and run `PYTHONPATH=.pylibs blender -b -P build_mansion.py`.

The GLB is the web copy: textures are resized to 1024 px and stored as JPEG; the .blend and `tex/` keep the full-res maps.

`build_room.py` writes `../world3d/models/room/room-<theme>.glb` (about 300 KB each); `-- --theme pilot` builds one. Tap targets are Empties named `tap_<id>`.
