# PRD status (2026-10-08)

Honest state of each PRD section. "Tested" means a passing automated test; "seen" means a headless-browser screenshot. Nothing here has run on a phone.

| PRD section | State | Where |
| :--- | :--- | :--- |
| 5 Lobby interview | Built by another workstream (`interview/`), tested. The intro still opens with the receptionist, which contradicts "a voice with no face"; product decision. | `interview/`, `studyworld/profile.js` |
| 6 Tower: climb, floors, window states | Engine tested. Rendering seen. Campus skyline (up to 8), friend search by synthetic display name, view-only room card, friends stored on-device. Safety rules are only data flags until a backend exists. | `studyworld/engine.js`, `tower/`, `app/towerAdapter.js` |
| 7 Room | Four themed clay rooms from Blender, orbit, 7 tap targets with 44 px labels, floor-based window view, flat fallback. Seen. | `blender/build_room.py`, `world3d/room-clay.html`, `world3d/RoomClay.js` |
| 8 Desk | A demo Desk exists from another workstream (`desk/`, tested). Room to Desk to Room works with the exit summary. The shipped whiteboard tutor is not in this repo. | `desk/`, `world3d/study/study-demo.html` |
| 8 Verified events to a backend | Server with sessions, heartbeats, server-stamped events, authenticated accounts. Tested over HTTP. Not deployed; in-memory or one JSON file. | `studyworld/server.mjs` |
| 9 Pass Guarantee | Engine (waiting, strikes, claims) hardened and tested. Portal adapters and the fallback. Claim review (pay, hold, deny). Explained strike notices. | `engine.js`, `portal.js`, `notices.js`, `fraud.js` |
| 9 Unit economics | Model reproduces the PRD table and adds costs at 100k and 10k. Costs are placeholders. | `studyworld/economics.mjs` |
| 10 Spikes | See `studyworld/SPIKES.md`. | |
| 11 Metrics and kill criteria | Not built: no analytics, no A/B switch. The room is a separate URL, so a room vs desk-only split is possible but unwired. | |
| 12 Phasing and gates | Gate 1 (grades verified at two schools) is **not met**. No school has been connected. | |
| 13 Decisions | None closed by this work. Proposals live in `POLICY`, `STRIKE_RULES` and `SPIKES.md`. | |

## Blocked on something outside the code

1. **Real school portals** (Gate 1). Needs a school partnership or SSO.
2. **Phone performance** of the tower and the room. Needs a real device: open `tower/index.html?bench=1`.
3. **Receptionist licence.** The supplied FBX shipped without a licence. Replace or clear it before a paid launch (`world3d/CREDITS.md`).
4. **The 2D whiteboard Desk**, to replace the demo Desk.

## Tests

`for f in $(find . -name "*.test.mjs" -not -path "./vendor/*"); do (cd $(dirname $f) && node --test $(basename $f)); done`
Smoke (pages and assets, not console errors): `python3 -m http.server 8765` from the project root, then `node smoke.mjs`.
