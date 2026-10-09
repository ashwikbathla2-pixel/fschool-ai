// Landing -> app data sync. The cinematic landing stores a legacy profile ('fschool.profile': career_goal, interests, ...);
// the Study World app reads the v1 profile (contract.js, built by studyworld/profile.js). This keeps the two in step.
// A profile the student made in the interview is never overwritten: landing only fills what the interview has not answered.
import { buildProfile, themeFor } from '../studyworld/profile.js';
import { loadProfile, saveProfile } from './contract.js';

// careers.json key -> the free-text dream the theme matcher understands.
const DREAM = { doctor: 'doctor', engineer: 'engineer', software: 'software developer', scientist: 'scientist', entrepreneur: 'entrepreneur',
  designer: 'designer', artist: 'artist', architect: 'architect', lawyer: 'lawyer', astronaut: 'astronaut pilot', undecided: '', unknown: '' };

export function legacyToProfile(legacy, existing = loadProfile()) {
  const key = legacy?.career_goal || '';
  const dream = DREAM[key] ?? key;
  if (existing && !existing.landing && existing.dream?.text) return existing;                        // interview answers win
  const base = buildProfile({ dream, courses: existing?.courses || [], hours: existing?.hoursPerWeek, worried: existing?.worriedCourse });
  return { ...base, landing: { career_goal: key, confidence: legacy?.confidence ?? 0, interests: legacy?.interests || [], foundations: legacy?.recommended_foundations || [] },
    room: { ...base.room, theme: themeFor(dream) } };
}

export function syncLanding(legacy) {
  if (!legacy?.career_goal) return null;
  const p = legacyToProfile(legacy);
  saveProfile(p);
  return p;
}

// App -> landing direction: if the app already has a profile, the landing can read its career back.
export function landingFromApp(p = loadProfile()) {
  return p?.landing ? { career_goal: p.landing.career_goal, confidence: p.landing.confidence } : null;
}
