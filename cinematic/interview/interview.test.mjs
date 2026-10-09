import assert from 'node:assert/strict';
import { parseCourses, addCourses, matchChoice, matchCourse, answerReady, newState, draftOf, resumable, restoreState, finishProfile, micMessage } from './Interview.js';
import { greet, reflectWhy, learningLine, hoursLine, worriedLine, guaranteeLine, offerBlock, meetLines, violations } from './futureSelf.js';
import { STEPS, themeFor } from '../studyworld/profile.js';

const step = id => STEPS.find(s => s.id === id);

// courses
assert.deepEqual(parseCourses('PHY121, math 101 and Chem; phy121\n'), ['PHY121', 'math 101', 'Chem']);
assert.deepEqual(parseCourses(''), []);
assert.deepEqual(addCourses(['A'], 'b, a'), ['A', 'b']);
assert.equal(parseCourses(Array.from({ length: 30 }, (_, i) => 'c' + i).join(',')).length, 12);

// voice -> choices
assert.equal(matchChoice(step('learning'), 'I like to watch diagrams'), 'seeing');
assert.equal(matchChoice(step('learning'), 'talking it through'), 'talking');
assert.equal(matchChoice(step('learning'), 'banana'), null);
assert.equal(matchChoice(step('hours'), 'about ten hours'), 8, 'tie between 8 and 12 goes to the lower, safer plan');
assert.equal(matchChoice(step('hours'), 'twelve'), 12);
assert.equal(matchChoice(step('hours'), '6'), 5);
assert.equal(matchChoice(step('hours'), 'lots'), null);
assert.equal(matchCourse(['PHY121', 'MATH101'], 'I am worried about math101'), 'MATH101');
assert.equal(matchCourse(['PHY121'], 'nothing'), null);

// readiness + pause/resume
assert.equal(resumable(null), false);
assert.equal(resumable(draftOf(newState())), false, 'empty draft is not worth a prompt');
const mid = { i: 2, answers: { dream: 'pilot', why: 'sky' }, portal: 'failed' };
assert.equal(resumable(draftOf(mid)), true);
assert.deepEqual(restoreState(JSON.parse(JSON.stringify(draftOf(mid)))), mid);
assert.deepEqual(restoreState({ v: 9 }), newState(), 'unknown draft falls back to fresh');
assert.equal(resumable({ v: 1, i: 99, answers: { dream: 'x' } }), false);
assert.equal(answerReady(step('dream'), { dream: '  ' }), false);
assert.equal(answerReady(step('hours'), { hours: 0 }), true);
assert.equal(answerReady(step('courses'), { courses: [] }), false);

// portal failed/skipped: typed courses finish, guarantee stays off with reason
const typed = finishProfile({ dream: 'pastry chef', why: 'oceans', learning: 'doing', courses: ['BIO101'], hours: 8, worried: 'BIO101' });
assert.equal(typed.guarantee.state, 'off');
assert.match(typed.guarantee.reason, /grade source/i);
assert.equal(typed.dream.theme, 'studio', 'dream outside launch themes gets Studio');
assert.equal(themeFor('I want to be a pilot'), 'pilot');
assert.deepEqual([typed.futureSelf.photo, typed.futureSelf.voiceClone], [false, false]);
assert.equal(typed.firstBlock.minutes, 25);
assert.match(guaranteeLine(typed), /off/i);
assert.ok(micMessage('not-allowed').includes('type'));
assert.ok(micMessage('weird').includes('type'));

// future self guardrails: no first-person past-memory phrasing, across themes and awkward inputs
const profiles = [typed, finishProfile({ dream: 'pilot', why: 'I love flying', learning: 'seeing', courses: ['PHY121'], hours: 12, worried: 'PHY121' }),
  finishProfile({ dream: '', courses: [] }), finishProfile({ dream: 'doctor', why: 'I was scared once', learning: 'talking', hours: 3 })];
for (const p of profiles) for (const l of [...meetLines(p), offerBlock(p), greet(p), reflectWhy(p), learningLine(p), hoursLine(p), worriedLine(p)])
  assert.deepEqual(violations(l), [], 'guardrail: ' + l);
for (const bad of ['I froze on this in first year.', 'When I was your age I struggled.', "I've been there.", 'I remember failing.', 'Years ago I studied this.', 'My first term was rough.'])
  assert.ok(violations(bad).length, 'checker catches: ' + bad);
assert.deepEqual(violations('You said “I was scared once”. We start now.'), [], "student's own quoted words are not the persona's memory");
assert.match(offerBlock(typed), /25-minute block/);
assert.match(greet(profiles[2]), /the person you want to be/, 'empty dream still reads fine');
console.log('interview tests ok');
