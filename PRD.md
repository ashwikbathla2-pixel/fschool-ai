# FschoolAI Study World PRD

**Date:** Oct 5, 2026  
**Author:** @VincentYang  

---

## 1. Summary and Product Feeling

FschoolAI becomes one public tower where every student owns a room, climbs floors by doing real study, and is guaranteed not to fail: the tutor speaks as the student's own future self, and the Pro plan pays out if a covered course is failed while the plan was followed.

> **How to read this doc:** Most sections end with **Sachcit decides**: questions engineering has to answer before we build. Comment on any line you disagree with. This is a thinking document, not a finished spec.

### The feeling in one line
**Protected at the bottom, becoming your future self at the top.**

Two forces, and they balance each other:
- **The Pass Guarantee is the floor:** You will not fail, we've got you.
- **The climb toward your future self is the ceiling:** Become who you're meant to be.

Most edtech does one or the other. Pure gamification pushes and stresses; pure tutoring is safe and boring. We do both.

### Why this is not a tutor tool
ChatGPT already won free tutoring, so we do not compete there. The guarantee is what gets a student in the door, because no tutor tool can promise it. The world — tower, room, future self — is what keeps them. The tutor is the engine that makes both true.

### Core Principles
- **Calm, not loud:** White studio calm, closer to an Apple product shot than a game. No neon arcade.
- **Progress you can see:** You see how far you've climbed and who you're climbing toward. Numbers come second.
- **Ambition, not a prison:** Higher floors mean better views and bigger rooms.
- **One continuous world:** Every move between levels is a camera move, never a page load.

---

## 2. References

| Reference | What we take | What we leave |
| :--- | :--- | :--- |
| **Henry Heffernan's 3D desk portfolio** | Matte clay render, one hero desk, drag to rotate | His desk, props and layout |
| **Silo interactive cutaway map** | Cross-section tower, zone labels, dive from tower to room | Dark bunker mood, the show's world |
| **FschoolAI study room today** | The working whiteboard, its calm, the keypoints rail | Nothing. This is home |

> **Prototypes to open while reading:** 3D study room prototype and product design screens.

---

## 3. Problem, Goals, Non-Goals

Our study room works, but it looks like Hyperknow, and nothing in it makes a student come back tomorrow. A leaderboard number feels like nothing. A room you watch rise up a tower feels like something.

**Who it's for:** University students who want a specific career and are worried about a hard course. Under-18 students are an open question (see safety in section 6).

### Goals
- Students come back weekly because they want to see their floor, not because we sent a notification.
- Every paying student has an active plan and an active Pass Guarantee.
- A screenshot of the tower is instantly recognizable as FschoolAI.
- Day-30 retention rises from `[CURRENT]` to `[TARGET]`.

### Non-goals for this year
- Walking avatars or free roaming in 3D.
- Real-time multiplayer movement inside rooms.
- Rebuilding the tutor. The 2D desk already exists; we wrap a world around it.
- Student-made 3D models.

> **Sachcit decides:** Which of these non-goals would you push back on, and why?

---

## 4. The Zoom Model: Tower, Room, Desk

The whole product is three environments joined by one camera: zoom into the public tower, tap a unit to enter a 3D room, tap inside the room to drop into the 2D whiteboard tutor.

### Navigation Hierarchy

```
        +----------------------------+
        |           Lobby            |
        |      (First visit only)    |
        +----------------------------+
                      |
                 [room built]
                      v
        +----------------------------+
        |           Tower            |  (Public, every student)
        |    Your floor is your rank |  (Find me, find friends)
        +----------------------------+
                   ^        |
        [pinch out]|        |[tap a room]
                   |        v
        +----------------------------+
        |           Room             |  (Your 3D clay room)
        |    Themed to your dream    |  (Tap objects to act)
        +----------------------------+
                   ^        |
      [exit summary|        |[tap the desk]
                   |        v
        +----------------------------+
        |           Desk             |  (2D whiteboard tutor)
        |    Reggie and keypoints    |  (Learning happens here)
        +----------------------------+
```

*Every move is a camera move. Back always goes up one level.*  
*Zoom model: lobby once, then tower, room, desk.*

The lobby happens once; after that, the app opens on the student's own room.

| Level | What you see | Main actions | How it's built |
| :--- | :--- | :--- | :--- |
| **Tower (public)** | A cutaway of every floor, named zones, lit windows | Find me, find friends, tap any room | Pre-rendered room snapshots on instanced blocks |
| **Room (personal, 3D)** | Your clay-style room themed to your dream | Rotate, tap objects, enter the desk | Three.js scene from a shared shell and prop kit |
| **Desk (2D)** | Today's whiteboard tutor, themed to your dream | Learn, take notes, finish keypoints | The existing product, unchanged at its core |

### Rules for Moving Between Levels
1. Every move is a continuous camera move, never a blank loading screen.
2. Pinch out or the back button always goes up exactly one level.
3. The Desk opens on its own from a link, so a student on a weak laptop can study without loading 3D.
4. Leaving the Desk plays a short summary, then the camera pulls back into the room so the student sees what changed.

> **What opens the Desk from the Room is not decided yet:** Proposal: the desk or monitor is the one main entry and always works. Other objects are shortcuts (see section 7).  
> **Sachcit decides:** Is the Desk the same app with a 3D layer on top, or a separate page we route to? Can we keep the 3D scene in memory while the Desk is open so the return feels instant?

---

## 5. Onboarding: The Lobby Interview

A new student sees the whole tower first, the camera carries them inside, and a voice with no face interviews them; at the end that voice becomes a person — their own future self — and the room is built in front of them.

1. **Arrive:** The first thing a new student ever sees is the tower itself, standing in front of them. The camera then moves in through the entrance.
2. **A voice, no face:** There is no character, no mascot and no avatar at this point. Just a calm voice. Nothing to look at yet, because the student's future self does not exist until they say who they want to become.
3. **Interview:** Six short parts, voice or text:
   - **a.** Dream job.
   - **b.** Why that dream.
   - **c.** How you learn best: seeing, doing, reading, or talking it through.
   - **d.** Your courses this term (connect the school portal here).
   - **e.** Hours you can really study each week.
   - **f.** The course you're most worried about.
4. **The voice becomes someone:** The answers give the voice a face. The student's future self steps out of it — the pilot, the doctor, the engineer they said they wanted to be. This is the first character they see, and it is a version of them. There is no Reggie and no mascot anywhere in the product; the future self is the single tutor presence from here on.
5. **Room build:** The room assembles in clean white space around them, built from their answers. This is the moment people screenshot.
6. **First floor:** The elevator opens on the ground floor. The student sees the tower above them.
7. **First block:** Their future self offers a 25-minute block right away, so day one ends with real progress.

### Acceptance Criteria
- [ ] Interview takes under `[X]` minutes and can be paused and resumed.
- [ ] Voice and text both work on phone and laptop.
- [ ] If the portal won't connect, the student can still finish by typing courses. The guarantee stays off until a grade source is verified.
- [ ] The room-build animation plays once and can be skipped.
- [ ] A dream outside our launch themes still gets a good room (see section 7).

> **Sachcit decides:** What does the interview output look like as data? Which fields drive the room, which drive the future self, and which drive the plan? How do we turn a free-text dream like "marine biologist" into a theme? And what are the guardrails on the future self: it must never invent biographical memories ("I froze on this in first year" is a story, not a memory), never be built from a real photo, and never clone the student's voice.

---

## 6. The Tower: The Leaderboard You Can See

Every student is one room on one floor, and your floor is your rank: study for real and you move up into a better room; stop and you drift down.

### How you climb (proposal)
- A **Climb score** built only from verified study: plan blocks finished, keypoints mastered, grades improving.
- The score looks at the last `[N]` days, so an inactive student drifts down and a returning one can climb back fast.
- Floors are reassigned `[daily / hourly]`. Moving up plays an elevator moment; moving down gets a gentle note from your future self, not a red alert.

### One tower or many?
**Proposal:** Each school gets its own tower, and all towers stand together as a skyline. That keeps each tower to thousands of rooms instead of millions, and keeps the skyline readable.

### What a window shows
| Window state | Meaning |
| :--- | :--- |
| **Light on** | Studying right now |
| **Warm glow** | On a streak |
| **Dim** | Not active lately |
| **Shield on the door** | Pass Guarantee active |

### Social and Safety
- **Visiting:** Tap any window to see a room card: display name, dream, floor, streak, what they're studying now. Then visit the room (look, don't touch).
- **Safety:** Every room is public, so we decide what strangers can see.  
  *Proposal:* No real names or schools shown by default, no messaging strangers, visits are view-only, and under-18 rooms are hidden from strangers.

> **Sachcit decides:** How floors are assigned when thousands share the same score; how often to recompute; per-campus towers or one global tower; how a student finds a friend fast.

---

## 7. The 3D Room

Each room floats in clean white space and is one shared shell dressed with a dream's prop set, one accent color and a window view, so we build one kit, not millions of rooms.

**Launch themes:** Pilot (cockpit), Coder (hack house), Doctor (clinic), plus a neutral Studio for any other dream until its theme exists.

### Starter room
The tutor builds a themed starter room from the interview: same white, floating, minimal base, dressed with the dream's props, with five or six dream buckets at launch and a neutral Studio default. The themed room is the reward for the interview; a generic room makes the onboarding promise fall flat.

### Your floor shapes your room
- **Low floors:** A small room with a view of the next building.
- **High floors:** A corner room with the skyline. The climb shows up inside your own room, not only on the tower.

### What you can tap (proposal)
| Object | What it does |
| :--- | :--- |
| **Desk or monitor** | Opens the 2D Desk. The main entry; always works |
| **Whiteboard** | Today's plan |
| **Bookshelf** | Past sessions and notes |
| **Your future self** | Talk to your future self by voice or text |
| **Trophy shelf** | Milestones and guarantee status |
| **Window** | Zoom out to the tower |
| **Door** | Who visited, friends nearby |

### Visual Direction
- **Look:** Matte clay objects on an infinite white background, soft daylight, the object is the hero. Closer to an Apple product shot than a game world. Not photoreal, not neon, not fantasy.
- The student changes the colors, not us.
- **Aesthetic warning:** Minimal design is harder, because with nothing to hide behind, the few objects present on day one have to look excellent.

### Acceptance Criteria
- [ ] Room opens in under `[2]` seconds on a mid-range phone.
- [ ] If 3D fails to load, show a flat illustrated room with the same tap targets.
- [ ] Every tap target is at least 44 points and has a text label for screen readers.

> **Sachcit decides:** Who makes the 3D assets (in-house, contractor, or a store kit), and what each theme costs us to produce. What happens to a room, and to the future self, when a student changes their dream? That moment should feel like growth, not loss.

---

## 8. The Desk: The 2D Whiteboard Tutor

The Desk is the study room we already ship and stays the place where learning happens; the new work is getting in, getting out, reporting what the student did, and reskinning the board to match the student's dream.

- **What stays:** Infinite whiteboard, diagrams, embedded video and the Class Keypoints rail.
- **What goes:** Reggie, and the notebook-and-highlighter look. The board now matches the room.

### One lesson, three dreams
The learning content is identical for every student — the same notes, formulas, figure and check-yourself question, in the same grid. What changes is the framing:
- Materials and color
- Labels (`FLIGHT PHY 121` / `CASE PHY 121` / `~/phy-121`)
- Progress metaphor (`preflight checklist` / `today's rounds` / `tests passing`)
- Future self's portrait, voice, and hint.  
*(Three built examples are on the product design canvas.)*

One identical layout is skinned per theme at launch; theme-specific layouts are out of scope.

### What's new
- **Arrives with context:** Entering from the room opens the right course and today's plan block, not a blank board.
- **Climb feedback:** Finishing a keypoint plays a small elevator tick on the rail, the same motion as the tower.
- **Exit summary:** Leaving shows what was done (block finished, keypoints mastered, climb gained), then the camera pulls back into the room.
- **Polish:** Clean, Apple-like UI: calm type, generous space, no clutter.

### Acceptance Criteria
- [ ] The Desk works on its own from a link, with no 3D loaded.
- [ ] Every finished block and keypoint sends one verified event to the backend.

> **Sachcit decides:** What counts as a verified event? Time on board, a quick check question, real writing on the canvas, or the tutor's judgment? This one answer feeds the climb and the guarantee.  
> *Related:* The progress bar must be mastery-based, not completion-based — it fills when the tutor is confident the student understands, not when they have clicked through five problems. Define what "mastered" means per topic.

---

## 9. Pass Guarantee (Grade Insurance)

The guarantee is the reason a student leaves ChatGPT and signs up here, and it is sold as its own tier: Basic is the tutor, Pro is the tutor with every course you are taking guaranteed, paying out if you fail while following the plan.

### Pricing structure: two tiers
- **Basic ($15/month):** The tutor, with no payout risk attached — safe revenue.
- **Pro (~$49/month):** Carries all-course coverage and is priced to fund the payouts.  
*(Our nearest competitor charges $50 with no guarantee at all, so Pro at around $49 is the same price for strictly more product.)*

### All courses, never per course
Per-course coverage looks flexible but it is a trap: students would insure only the course they expect to fail, so every policy sold is high-risk and the claim rate climbs. All-course coverage means the easy courses a student will pass subsidize the hard one they might fail, which is how insurance is supposed to work.

### Financial Model
*At 100,000 students: half on Pro at $49/mo, half on Basic at $15/mo ($38.4M annual revenue), $2,000 per claim:*

| Claim rate among Pro students | Revenue | Payouts | Net before opex |
| :--- | :--- | :--- | :--- |
| **5% (good case)** | $38.4M | $5.0M | $33.4M |
| **10% (middle case)** | $38.4M | $10.0M | $28.4M |
| **20% (bad case)** | $38.4M | $20.0M | $18.4M |

> **The investor line:** Even if one in five Pro students fails and claims the full $2,000, the tiered model still nets $18.4M before operating costs.  
> *Two honest caveats:* This is revenue minus payouts only, with no staff, compute or marketing subtracted; and 100,000 students in year one is ambitious, so the same model should be shown at 10,000 to prove the per-student economics stand on their own.

### Controlling the failure rate
The failure rate is not a number we bet on, it is a number we control. Three levers set it:
1. The **strike system** removes students who do not do the work.
2. The **tutor** closes the gaps so fewer fail.
3. **Eligibility** decides who is covered at all.  
*(University course failure rates typically run 10–15% without help, so 10% is a fair middle case and the tutor should push it down.)*

### Market Precedents
Pass-or-refund guarantees are an established model (Surgent, Kaplan's PPI, BloomTech), and the profitable ones share three traits:
1. Proof-of-effort requirement before any refund.
2. Free retake offered ahead of cash.
3. Deliberately tight eligibility.

Our strike system is the first of these. The harder problem is that those companies cover one clean exam, while we cover university courses across many schools, so **verification**, not payout math, is our real risk.

### Rules (Proposal)
- Covered once **80% of plan blocks** for that course are done, measured by mastery rather than completion.
- **14-day waiting period** after joining, so students can't sign up in week 10 while already failing.
- The final grade must come from a verified source (school portal).
- **One claim per course, capped at $2,000.**
- **Three strikes and coverage ends.** The tutor reads the student's full context — past records, current grades — predicts a likely outcome, and builds the plan from it. If the student is not using the platform the way the plan requires, they take a strike. Three strikes and they are out of the policy: no $2,000. Stay inside the plan and fail anyway, and the payout stands.
- *Still open:* What exactly triggers a strike (missed sessions, mastery below threshold, ignoring the plan, missed checkpoints), whether strikes reset or accumulate, and whether a strike can be worked off. The enforcement logic cannot be coded until these are pinned down.

### In the World
A shield on your room's door and your trophy shelf, plus a visible strike count. The claim is detected automatically from the portal, needs no uploads, and comes with a retake plan from your future self.

| State | Shown as | What the student sees |
| :--- | :--- | :--- |
| **Protected** | Green shield | Plan on track |
| **At risk** | Orange shield | Plan or grade slipping, with the fix |
| **Waiting period** | Indigo shield | The date coverage begins |

### Risks and Legal
- **Moral hazard / intentional failure:** A student could fail on purpose to collect $2,000.  
  *Ideas to test:* Pay the money as retake tuition or account credit instead of cash; require the student to sit the final; review any claim where effort collapses late in the term.
- **Legal:** Selling something called insurance usually needs a licence, which is why the product says "Pass Guarantee." Counsel must review the name, terms and payout before launch.

> **Sachcit decides:** The strike triggers and thresholds, and the claim rate our own data implies.  
> **Vincent's call:** Cash payout stays, in the $1,000–$3,000 range, because it is the marketing hook. Sachcit's job is to prove the strike system and the tutor hold the claim rate well under the break-even line. The business case and the product design are the same decision here — stricter rules mean lower payouts but more churn, and a longer waiting period means less adverse selection but a worse day-one feeling.

---

## 10. Technical Architecture and Spikes

One event stream of verified study feeds everything: the climb, the guarantee and the tower, so getting that event right is the core engineering job.

### System Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                                App: Web and iOS                                 |
|                                                                                 |
|  +--------------------+     +---------------------+     +--------------------+  |
|  |     Tower view     |     |      Room (3D)      |     |     Desk (2D)      |  |
|  | Floors and windows |     | Shell plus prop kit |     |  Whiteboard tutor  |  |
|  +--------------------+     +---------------------+     +--------------------+  |
+------------|---------------------------|--------------------------|-------------+
             |                           |                          |
          (floor)                   (room data)               (study actions)
             v                           v                          v
   +--------------------+     +---------------------+     +--------------------+
   |    Climb score     |     |        Rooms        |     |   Reggie + plan    |
   | Rank becomes floor |     | Config & snapshots  |     | reads school portal|
   +--------------------+     +---------------------+     +--------------------+
             \                           |                          /
              ---------------------------+--------------------------
                                         |
                                         v
   +---------------------------------------------------------------------------+
   |             Verified study events: one stream feeds everything            |
   +---------------------------------------------------------------------------+
                                         |
                     +-------------------+-------------------+
                     | (grades)                              |
                     v                                       v
        - - - - - - - - - - - - -                +-----------------------+
        '    School portals     '                |    Pass Guarantee     |
        ' (external, per school)'                |  Coverage and claims  |
        - - - - - - - - - - - - -                +-----------------------+
```
*(Dashed boxes are outside our control. If the event stream is wrong, the floors and the payouts are all wrong at once.)*

### Spikes to run before committing (1–2 weeks each)
- [ ] **Tower render:** Show 10,000 rooms in a cutaway on a mid-range iPhone, smoothly, using instanced blocks and room snapshots.
- [ ] **Room load:** One themed room under 2 seconds on a phone (compressed models and textures).
- [ ] **3D to 2D handoff:** Desk tap to whiteboard with no blank frame, and back.
- [ ] **Grade verification:** Pull a final grade from two real schools' portals. If this fails, the guarantee can't launch.
- [ ] **Real-work signal:** A first rule for what makes a block verified, tested against people trying to cheat.
- [ ] **Room snapshots:** Cost and time to re-render a room picture each time it changes.
- [ ] **Mastery measurement:** Define what "mastered" means per topic and what signal proves it — a score, repeated attempts, explaining it back, or solving a transfer problem. Research how Hyperknow and other platforms measure it, and validate against how real university courses are actually structured. The guarantee is only as strong as this definition.
- [ ] **Strike detection:** The pipeline that watches plan adherence, issues strikes, warns the student, and removes coverage at three. Must be explainable to the student at every step.
- [ ] **Unit economics with opex:** Rebuild the section 9 model with staff, compute and marketing subtracted, and run it again at 10,000 students.
- [ ] **Break the guarantee:** List every way someone could collect $2,000 unfairly, and how a strike or verification step would catch each.
- [ ] **Tutor differentiation:** Define what actually makes one student's tutor different from another's — teaching style, pacing, difficulty sequencing, explanation depth. "Personalized" has to mean something specific in the code, or we are a ChatGPT wrapper with a tower on top.

---

## 11. Metrics and Kill Criteria

The one number that matters is **weekly verified study hours per student**; the world only earns its cost if it moves that number.

| Metric | Why it matters | Target |
| :--- | :--- | :--- |
| **Weekly verified study hours per student** | The north star | `[TARGET]` |
| **Day-30 retention** | Does the world bring people back | `[TARGET]` |
| **Room to Desk entry rate** | Is the room a door, or just decoration | `[TARGET]` |
| **Tower visits per student per week** | Does the tower pull people in | `[TARGET]` |
| **Plan completion rate** | Effort behind the guarantee | `[TARGET]` |
| **Claims paid vs revenue** | Is the guarantee affordable | `[TARGET]` |

### Kill criteria (agree on them before building)
- If students with the 3D room don't study more than students without it after `[N]` weeks, the room becomes optional and we focus on the Desk.
- If fewer than `[X]%` of room visits lead to a Desk session, the room is decoration. Redesign or cut.
- If claims cost more than `[Y]%` of revenue in the first term, pause new guarantee sign-ups and reprice.

> **Sachcit decides:** Can we run the room as an A/B test from day one, so we know whether it works instead of guessing?

---

## 12. Phasing

Build from the inside out: the Desk and the guarantee first, the Room second, the Tower third, and each phase ships only after the gate before it passes.

### Roadmap

```
+------------------------------------+
|           PHASE 1 (NOW)            |
|          Brain and Desk            |
|  - Interview and portal sync       |
|  - Plan and Desk upgrades          |
|  - Pass Guarantee, one term        |
+------------------------------------+
                  |
             [ Gate 1 ]
       (grades verified at two schools)
                  v
+------------------------------------+
|              PHASE 2               |
|               Room                 |
|  - 3D room, 3 dream themes         |
|  - A/B test against Desk only      |
+------------------------------------+
                  |
             [ Gate 2 ]
       (room raises study hours)
                  v
+------------------------------------+
|              PHASE 3               |
|               Tower                |
|  - Campus towers in a skyline      |
+------------------------------------+
```

- **Dates are left off on purpose:** Sachcit sets them after the spikes in section 10.
- **Why this order:** The guarantee is what students pay for, and it can't launch without grade verification. The room and tower are what bring them back, but a beautiful tower over a weak tutor is a ghost town.

---

## 13. Decisions Sachcit Must Make

Twelve decisions block the build; the first four decide whether the whole system works, so they come first in the kickoff.

| # | Decision | Options | Recommendation | Owner | Status |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | What counts as verified study | Time on board, check questions, canvas activity, tutor's judgment | A mix, tested against cheating | Sachcit | **Open** |
| **2** | Grade verification when a school blocks the portal | Manual transcript upload, school partnership, no coverage | No coverage until verified | Sachcit | **Proposed** |
| **3** | Climb score inputs and time window | Blocks only, blocks plus grades, rolling window length | Blocks plus keypoints, rolling window | Sachcit | **Open** |
| **4** | Guarantee payout form | Cash, account credit, retake tuition | Retake tuition or credit | Vincent and counsel | **Open** |
| **5** | Desk inside the 3D app or a separate page | One app with a 3D layer, separate route | Decide after the handoff spike | Sachcit | **Open** |
| **6** | What opens the Desk from the room | Desk only, any object, your future self | Desk primary, others as shortcuts | Vincent | **Open** |
| **7** | One tower or one per campus | Global tower, campus towers in a skyline | Campus towers | Vincent and Sachcit | **Open** |
| **8** | 3D asset pipeline | In-house, contractor, store kit | Store kit plus a contractor for themes | Sachcit | **Open** |
| **9** | Under-18 students | Allowed, allowed with private rooms, not allowed | Private rooms only | Vincent | **Proposed** |
| **10** | Strike triggers, reset rules and thresholds | Missed sessions, mastery below threshold, plan adherence, missed checkpoints | Define before any build; enforcement cannot be coded without it | Sachcit | **Open** |
| **11** | Pro tier price | $39, $49, $59 a month, all-course coverage | $49, matching the competitor's price with strictly more product | Vincent | **Proposed** |
| **12** | Mastery signal per topic | Score, repeated attempts, explain-back, transfer problem | A mix, defined per subject, tested against the real exam | Sachcit | **Open** |

---
