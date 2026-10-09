# PRD section 10 spikes: what exists, what it answers, what it does not

Updated 2026-10-08. Run everything with `node --test <file>` from this folder (Node 18+, no installs).

| Spike | Built | Answer so far | Not answered |
| :--- | :--- | :--- | :--- |
| **Tower render** | `../tower/` (`towerData.js`, `tower.js`) | 10,000 rooms in 5 draw calls; 5 campuses (29,500 rooms) in 14. Layout, picking, skyline and friend search are tested. | **Frame rate on a mid-range iPhone.** The benchmark (`?bench=1`) runs, but only a software renderer was available here. Run it on a phone. |
| **Room load** | `../world3d/room-clay.html`, `../blender/build_room.py` | Each themed room is about 300 KB and loaded in ~1 s on a software renderer (target 2 s). | A real phone, and a cold cache on mobile data. |
| **3D to 2D handoff** | Room, Desk and Tower pass `?from`, `?back` and a summary; `@view-transition` avoids a blank frame in Chromium | The round trip works across pages. The Desk can instead cancel `room:action` and run the move in the same app. | The real 2D whiteboard Desk is not in this repo; decision 5 (one app or separate route) is still open. |
| **Grade verification** | `portal.js` | An adapter contract plus two reference adapters (REST gradebook, CSV export) and a fallback. Typed or uploaded grades never start coverage (decision 2). | **Two real schools.** Needs each school's SSO, an OAuth app or a partnership. If this fails, the guarantee cannot launch. |
| **Real-work signal** | `engine.js` `verify()`, hardened; `server.mjs` | Presence plus one proof of understanding. Hostile numbers, future timestamps, 1-minute blocks and speed-clicked checks are rejected (`abuse.test.mjs`). | Tuning the thresholds against real students. |
| **Room snapshots** | The tower atlas renders per-theme snapshots in one texture | One atlas, 16 variants, zero per-room cost. | Cost and time to re-render a real room picture when it changes. |
| **Mastery measurement** | `mastery.js` | Mastered = weighted evidence of at least 0.8 **and** a production signal (explain-back or a transfer problem) **and** two kinds of evidence, fading over a 21-day half-life unless re-checked. Weights per subject type. | The weights are starting values. Validate against how real courses are examined (decision 12). |
| **Strike detection** | `notices.js`, `server.mjs` | Every strike is explained in numbers; a warning arrives mid-week while it can still be fixed; a final warning at two strikes; gentle tone; ledger is sticky. Work-off and reset are switches, off. | What triggers a strike beyond weekly blocks, and whether strikes reset (decision 10). |
| **Unit economics with opex** | `economics.mjs` | Reproduces the PRD table exactly. With costs: at 100,000 students break-even is a 24.1% Pro claim rate; at **10,000 students it is 13.4%**, and a 20% claim rate loses money. | Every cost line is a placeholder. Replace with real invoices and payroll. |
| **Break the guarantee** | `fraud.js` (12 documented attacks, each tied to a control), `server.mjs`, `abuse.test.mjs` | Hard flags deny, soft flags hold for a person. The server closes the replay, back-fill, overlap, heartbeat, plan-start, ledger and grade-source gaps. | G2 (paste measured server-side), G4 and G11 (policy numbers) still need decisions. |
| **Tutor differentiation** | `tutor.js` | A tutor is five derived fields (style, pace, difficulty, depth, hint levels). Two students get different tutors; the same student gets the same one. The brief carries the future-self guardrails. | Whether this raises mastery. That needs an A/B test with students. |

## Gaps in `abuse.test.mjs` now covered by the server

G1 (replay under a fresh id), G3 (auto-clicker, via server heartbeats), G8 (back-dated blocks and the sticky ended state), G9 (one session, one account), G10 (overlap and repeated plan block), G11 (daily cap), G12 (re-plan resets strikes), G13 (future plan start) are asserted in `server.test.mjs`. The pure-engine `todo` tests stay `todo` because the engine alone still cannot do these things.

## Policy numbers (proposals for Sachcit)

`server.mjs` `POLICY`: heartbeat credit, 48 h back-fill window, 8 blocks a day for the climb, 2 paid claims per term.
`notices.js` `STRIKE_RULES`: work-off and reset (both off), warning from day 3.5.
`fraud.js`: late-burst 50% in the last 10 days, effort collapse below 30% of the early rate, pasted share 30%.
