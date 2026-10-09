// LearningPath: builds the personalized path from a career entry and renders
// the dashboard layout the JourneyMap morphs into. Owner: Phyllis.
import { profile, updateProfile } from './state.js';

export function buildPath(career, key) {
  const modules = career.modules.map(([label, blurb], i) => ({ id: `m${i}`, label, blurb, order: i + 1 }));
  return { key, title: career.label, interpretation: career.interpretation, modules };
}

export function applyProfile(career, key, confidence) {
  updateProfile({
    career_goal: key === 'unknown' ? 'undecided' : key,
    confidence: confidence ?? profile.confidence,
    interests: career.interests.slice(),
    recommended_foundations: career.foundations.slice(),
  });
}

// Dashboard header + start action, placed beside the morphed module cards.
export function renderDashboardChrome(root, path, onBegin) {
  const head = document.createElement('div');
  head.className = 'cm-dash-head';
  head.innerHTML = `<p class="cm-eyebrow">Your path</p><h2></h2><p class="cm-sub"></p><button type="button" class="cm-begin"></button>`;
  head.querySelector('h2').textContent = path.title;
  head.querySelector('.cm-sub').textContent = path.interpretation;
  const btn = head.querySelector('.cm-begin');
  btn.textContent = `Begin with ${path.modules[0].label}`;
  btn.addEventListener('click', () => onBegin(path.modules[0]));
  root.appendChild(head);
  return head;
}
