# FschoolAI

Static-site prototypes for the FschoolAI study world: the cinematic intro, the 3D study room, the clay Room, the tower, the Desk, the backend events service, and the Blender builds that feed them. Product spec: [PRD.md](PRD.md). Status against the spec: [cinematic/STATUS.md](cinematic/STATUS.md).

## Requirements

| Tool | Version | Needed for |
| :--- | :--- | :--- |
| Git | any recent | cloning |
| Node.js | 18 for tests and the backend; 20.19 or newer for `r3f` (Vite 8) |
| Python | 3.10 or newer | the local web server, Blender numpy install |
| Blender | 4.0 or newer | rebuilding the 3D assets only (optional) |
| A Chromium-based browser | any | browsing the pages (WebGL needed) |

## Install

```sh
git clone <this repo> fschool-ai
cd fschool-ai
./scripts/install.sh      # installs npm dependencies and the numpy copy Blender's exporter needs
```

`scripts/install.sh` is idempotent. It runs `npm ci` in `r3f/` and installs numpy into `cinematic/blender/.pylibs/` (not system-wide).

## Run the pages

```sh
python3 -m http.server 8765        # from the repo root
```

Then open:

| Page | URL |
| :--- | :--- |
| Cinematic intro | http://localhost:8765/ |
| Clay Room | http://localhost:8765/cinematic/world3d/room-clay.html?theme=pilot&floor=120 |
| Tower (campus skyline) | http://localhost:8765/cinematic/tower/index.html?towers=5 |
| Study room (Desk) | http://localhost:8765/cinematic/world3d/study/study-demo.html |
| Desk reskin demo | http://localhost:8765/cinematic/desk/index.html?theme=coder |

Every page and its flags are listed in `cinematic/README.md`.

## Test

```sh
for f in $(find . -name "*.test.mjs" -not -path "*/node_modules/*" -not -path "./vendor/*"); do
  (cd "$(dirname "$f")" && node --test "$(basename "$f")" | grep -E "^# (pass|fail)" | sed "s|^|$f: |")
done
```

Smoke test (pages and local assets return 200; needs the server above running):

```sh
cd cinematic && node smoke.mjs
```

## Backend (study events)

```sh
cd cinematic/studyworld && PORT=8790 node server.mjs
```

In-memory by default. Set `STUDY_DATA=path/to/file.json` to persist. Grades can only be posted with the portal key (`PORTAL_KEY`).

## Rebuild the 3D assets

```sh
cd cinematic/blender
PYTHONPATH=.pylibs blender -b -P build_room.py        # four clay rooms -> world3d/models/room/
PYTHONPATH=.pylibs blender -b -P build_mansion.py     # campus exterior -> world3d/models/mansion/
```

Each build also writes a `.blend` next to its script. The GLBs are the web copies: textures are resized to 1024 px.

## Known gaps

- `r3f/` has its dependencies declared but no source files, so `npm run dev` has nothing to serve yet.
- The receptionist model's licence is unknown (see `cinematic/world3d/CREDITS.md`). Replace it before any paid launch.
- Nothing here has been run on a real phone; see `cinematic/STATUS.md`.
