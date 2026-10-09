// Desk pure logic (no DOM, no storage): mastery, clock, stroke counting, event assembly, summary. Imports only the engine so node can test it.
import { RULES } from '../studyworld/engine.js';

// proposal: how the placeholder tutor turns an answer into "mastery" (tutor confidence). A real tutor replaces this; engine.RULES.masteredAt is the bar.
export const CONFIG = Object.freeze({
  masteryFirstTry: 0.9,     // proposal: right on the first try
  masteryAfterMiss: 0.7,    // proposal: right after a miss stays below masteredAt, so one more clean answer is needed
  masteryMissPenalty: 0.2,  // proposal
  minStrokePoints: 3,       // a stroke needs this many points to count as a real canvas action
});

// Placeholder lesson: identical for every theme. Answers are numeric so the typed field can carry a paste listener.
export const LESSON = Object.freeze({
  id: 'phy121-forces', title: 'Forces and motion',
  notes: ['Net force makes mass accelerate: F = m a.', 'Weight is the pull of gravity: W = m g, with g = 9.8 m/s².', 'Forces in opposite directions subtract before you divide by mass.'],
  keypoints: [
    { id: 'kp-f-ma',  title: 'Force and acceleration', q: 'A 2 kg cart is pushed with 6 N. Acceleration in m/s²?', answer: 3 },
    { id: 'kp-weight', title: 'Weight',                q: 'What is the weight, in N, of a 5 kg box? (g = 9.8)',        answer: 49 },
    { id: 'kp-net',   title: 'Net force',              q: '10 N pushes right, 4 N pushes left on a 3 kg block. Acceleration in m/s²?', answer: 2 },
  ],
  check: { q: 'A net force of 20 N acts on a 5 kg object. Acceleration in m/s²?', answer: 4 },
});

// ---- pure logic ----------------------------------------------------------------------------------------------------------------
export const isCorrect = (typed, answer) => { const n = parseFloat(String(typed).trim()); return Number.isFinite(n) && Math.abs(n - answer) < 1e-6; };

// Mastery after an answer. prev = current mastery estimate for the keypoint (0..1).
export function nextMastery(prev, correct, missedBefore, cfg = CONFIG) {
  if (correct) return Math.max(prev, missedBefore ? cfg.masteryAfterMiss : cfg.masteryFirstTry);
  return Math.max(0, prev - cfg.masteryMissPenalty);
}

// Rail progress fills on mastery, not on clicks. masteries: { [kpId]: number }.
export function masteryFill(keypoints, masteries, masteredAt = RULES.masteredAt) {
  const done = keypoints.filter(k => (masteries[k.id] ?? 0) >= masteredAt).length;
  return { mastered: done, total: keypoints.length, fraction: keypoints.length ? done / keypoints.length : 0 };
}

// Timer that counts active time only. All times injected so it is testable. Hidden tab = paused.
export function createActiveClock(now = Date.now()) {
  let active = 0, since = null;
  return {
    start(t = Date.now()) { if (since == null) since = t; },
    pause(t = Date.now()) { if (since != null) { active += Math.max(0, t - since); since = null; } },
    read(t = Date.now()) { return active + (since != null ? Math.max(0, t - since) : 0); },
    get running() { return since != null; },
  };
}

// Counts real canvas actions: a stroke only counts if it had enough points. Clearing the board never adds or removes.
export function createStrokeCounter(cfg = CONFIG) {
  let count = 0, pts = 0, down = false;
  return {
    down() { down = true; pts = 1; },
    move() { if (down) pts++; },
    up() { if (down && pts >= cfg.minStrokePoints) count++; down = false; pts = 0; },
    get count() { return count; },
  };
}

// Event assembly: exactly the fields engine.verify reads.
export function keypointEvent({ blockId, kp, course, mastery, secondsPerCheck, pastedAi, ts }) {
  return { id: `keypoint:${blockId}:${kp.id}`, type: 'keypoint', course, ts, mastery, secondsPerCheck, pastedAi: !!pastedAi };
}
export function blockEvent({ blockId, course, ts, minutes = RULES.blockMinutes, activeMs, checkScore, canvasActions, secondsPerCheck, pastedAi }) {
  return { id: `block:${blockId}`, type: 'block', course, ts, minutes, activeMs: Math.round(activeMs), checkScore, canvasActions, secondsPerCheck, pastedAi: !!pastedAi };
}

// What the exit screen says. before/after are climbScore values; the verified block is what counts toward climb.
export function summarize({ blockResult, keypointsMastered, keypointsTotal, climbBefore, climbAfter }) {
  const gained = Math.round((climbAfter - climbBefore) * 10) / 10;
  return {
    blockVerified: !!blockResult?.verified, blockReason: blockResult?.reason || '',
    keypointsMastered, keypointsTotal, climbBefore, climbAfter, climbGained: gained,
  };
}

// Today's plan block from the profile (arrives with context, not a blank board).
export function planBlock(profile) {
  const p = profile || {};
  const course = p.worriedCourse || p.courses?.[0] || p.firstBlock?.course || 'PHY 121';
  return { course, minutes: p.firstBlock?.minutes || RULES.blockMinutes, theme: p.room?.theme || p.dream?.theme || 'studio' };
}

