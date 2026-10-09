# Pre-rendered plates (Unreal Engine flythrough)

The live three.js world cannot match Unreal's Lumen/Nanite look in a browser, so the exterior flythrough can be rendered in Unreal and played back by scroll.
`PlatePlayer.js` draws the frames on a canvas above the live 3D, keeps only ~20 decoded frames in memory, and hands over to the live 3D (which does the interior, the receptionist and the voice flow) at the doors.
No frames present, or `"enabled": false`, means the live 3D runs alone, exactly as before. `?plate=0` also forces it off.

## 1. Export the camera path (so Unreal follows the same route as the site)

```sh
cd cinematic
node --no-warnings --experimental-loader ./tools/three-loader.mjs tools/export-camera-path.mjs 240 42
```

Arguments: number of frames (default 240), vertical fov in degrees (default 42). Writes into `plates/mansion/`:

- `camera-path.json`: per frame position and look-at in three.js coordinates (metres, Y up).
- `camera-path-unreal.csv`: per frame `x_cm,y_cm,z_cm,pitch,yaw,roll,hfov_16x9` in Unreal coordinates (X forward, Y right, Z up, centimetres). Conversion used: X = -z, Y = x, Z = y, times 100.

Import the CSV into a Level Sequence (Python or Blueprint reading the rows into camera transform keys), one key per frame, linear interpolation. Roll is 0 throughout.

The path ends at the doors (`end` in `manifest.json`, the entrance scene at q = 0.72). Match that last frame to the live scene or the handover will jump.

## 2. Build the mansion in Unreal
- The live layout (metres): building facade around z = 0, plaza stairs between z = 60 and z = 13, pool near z = 60..70, FSCHOOLAI sign on the lower terrace wall. See `world3d/Exterior.js` and `Entrance.js` for the exact dimensions.
- Golden-hour lighting to match the site: warm low sun behind-left, purple sky fill, warm glowing windows. Lumen GI + reflections, Virtual Shadow Maps, Path Tracer if you can afford the render time.

## 3. Render
Movie Render Queue, 1920x1080, 240 frames (or the count you exported), PNG sequence, 8 spatial samples, anti-aliasing on, motion blur off (scrubbing back and forth looks wrong with it).

## 4. Convert to WebP (about 15-40 KB per frame at 1080p)

```sh
ffmpeg -i Frames/frame.%04d.png -vf scale=1920:-2 -c:v libwebp -quality 78 -compression_level 6 cinematic/plates/mansion/f_%04d.webp
```

(For an mp4 render, replace the input with `-i render.mp4`.) Check the frame count with `ls plates/mansion/*.webp | wc -l`.

## 5. Turn it on
Edit `plates/mansion/manifest.json`: `"enabled": true` and `"frames": <count>`. `start` is the first file number (1 for `f_0001.webp`). `pattern`, `pad`, `width`, `height` describe the files. `fade` is the share of the plate range used for the cross-fade into the live 3D.

Budget: keep the whole set under about 8 MB for the first scene (the low tier loads every 2nd frame automatically).
