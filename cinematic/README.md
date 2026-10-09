# Cinematic (FSCHOOL intro and demos)

Static site: plain HTML, ES modules and three.js. No build step.

## Run

```sh
cd fschool-ai          # the project root, the folder that contains index.html and cinematic/
python3 -m http.server 8765
```

Then open http://localhost:8765/ , which is the cinematic experience (the root `index.html` sets `<base href="cinematic/">`, so no `/cinematic/` path is needed). The URL paths in the table below are relative to the `cinematic/` folder, so add `/cinematic` in front when the server runs from the project root.

| Page | URL path |
| --- | --- |
| Cinematic intro (index) | `/` or `/index.html` |
| Career demo | `/career-demo.html` |
| Study room demo | `/world3d/study/study-demo.html` |
| Room demo | `/world3d/room-demo.html` |
| Clay Room (PRD section 7) | `/world3d/room-clay.html?theme=pilot&floor=120` (`theme` = pilot, coder, doctor, studio; or `?dream=text`; `?flat=1` forces the flat fallback) |
| Tower render spike (PRD section 10) | `/tower/index.html` (`?bench=1` runs the 13 s benchmark; run it on a real phone) |
| Character demo | `/world3d/char-demo.html` |
| Presence demo | not built yet (`world3d/study/Presence.js` is a module, no page) |
| Reggie demo | not built yet (no page in this folder) |

## Query flags

Append to any URL, e.g. `index.html?quality=low&motion=reduced`.

| Flag | Effect |
| --- | --- |
| `?quality=` | Forces a render tier (`quality.js`). A forced tier is never auto-downgraded. |
| `?motion=reduce` | Reduced motion (`quality.js`). Also follows the OS reduced-motion setting. |
| `?debug` | Debug mode (`world3d/Safety.js`). |
| `?glb=0` | Turns off the GLB model path in `World.js` (the low tier does the same). |
| `?avatar=file.glb` | Picks the avatar file from `world3d/characters/` (`Characters.js`). |
| `?pet=` | Overrides the pet model file (`world3d/study/Pet.js`). |
| `?career=` | Career preset for the study room (default `default`). |
| `?night=1` | Night lighting for the study room. |
| `?speed=` | Speed multiplier for the study room (default 1). |
| `?intro=1` | Study room intro line (`study-demo.html`). |

Other flags exist in code (`ang`, `light`, `mode`, `nocoat`, `rooms`, `post`, `ao`, `dof`, `reflect`, `renderer`, `stats`, `state`) but are not documented here yet.

## Folder map

- `index.html`, `career-demo.html`: top-level pages.
- `*.js` at this level: UI and flow (`CinematicOnboarding.js`, `VoicePrompt.js`, `MicrophoneInteraction.js`, `JourneyMap.js`, `CareerTransition.js`, `CareerClassifier.js`, `LearningPath.js`, `SceneTransition.js`, `ProgressIndicator.js`), shared state (`state.js`), audio (`audio.js`), performance (`quality.js`), data (`careers.json`), styles (`cinematic.css`).
- `scenes/`: intro scenes (`Welcome.js`, `Receptionist.js`, `ReceptionScene.js`, `SchoolEntrance.js`, `SchoolHallway.js`).
- `world3d/`: the 3D world. `World.js` is the entry. Rooms and builds in `Exterior.js`, `Entrance.js`, `Hallway.js`, `Reception.js`, `Dollhouse.js`; `Post.js` for postprocessing; `lighting.js`, `materials.js`, `pbr.js`, `Sky.js`, `Foliage.js`, `merge.js`; `characters/` (avatars and animation clips) and `models/`, `textures/`, `rooms/`. `study/` holds the study room (`StudyWorld.js`, `StudyRoom.js`, `Pet.js`, `FocusTimer.js`, `Presence.js`) and `study-demo.html`.
- `vendor/`: three.js r160 and addons, N8AO and postprocessing, with their licence files.
- `poster/logo.jpeg`: poster image.
- `AUDIT.md`, `QA.md`: QA notes. `world3d/CREDITS.md`: asset credits.

## Licence caveat

Read `world3d/CREDITS.md` before any public launch:

- The receptionist model (`world3d/characters/receptionist.glb`) is **CC BY-NC 4.0, non-commercial only**. It must be replaced before commercial use.
- The student avatar is a Ready Player Me sample; check its terms.
- The animation clips come from Mixamo data (free inside an app, not for redistribution as a standalone pack).
- The vendored three.js and addons are MIT.

## Blender builds

`blender/build_mansion.py` (campus exterior) and `blender/build_room.py` (the four clay rooms). See `blender/README.md`.
