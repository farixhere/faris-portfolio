/* ==========================================================================
   Shared content store. Data flow is unchanged from the original site:
   Supabase (public-read tables) → render. Both the portfolio and XIRAF OS
   read from this single object so they can never disagree.
   Tables: profile, skills, experiments, projects, posts, faq  (+ messages insert)
   ========================================================================== */
import { emit } from './util.js';

/* The publishable (anon) key is meant to be public; Row-Level Security protects the data. */
export const SUPABASE_URL = 'https://zrcfulryxnwffdlpudxo.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_4KcOsFvIRvjgI0JMMjZRqA_8uDrjodc';
export const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY) || null;

/* ── Profile defaults (overridden by the database) ───────────────────── */
export const data = {
  loaded: false,
  failed: 0,
  profile: {
    name: 'Faris',
    bio: 'A student exploring AI, technology, and whatever interesting thing comes next.',
    email: 'farisdomain@gmail.com',
    instagram: 'https://www.instagram.com/farixhere/',
    github: 'https://github.com/dupekingsam-code',
    linkedin: '',
    hero_image: ''
  },
  skills: [], experiments: [], projects: [], posts: [], faq: []
};

/* ── Honest fallbacks (shown only if the database has no matching entry) ── */
export const PROOFCHECK = {
  title: 'PROOFCHECK', category: 'CONCEPT', status: 'CONCEPT', sort_order: 9999,
  description: 'An idea for making decisions with evidence — gathering real reviews, discussions and experiences so you can judge what’s actually trustworthy.',
  details: 'PROOFCHECK is a project concept about evidence and trust. The idea is to bring together real-world reviews, discussions and lived experiences so people can make better decisions with proof instead of hype. It is still an idea being explored — not a launched product.',
  technologies: ['Concept', 'Reviews', 'Trust'], image_url: '', live_url: '', github_url: ''
};
export const FALLBACK_PROJECTS = [
  { title: 'ECHO', category: 'GAME', status: '', sort_order: 0, description: 'An interactive narrative / mystery game.', details: 'ECHO is an interactive narrative and mystery game.', technologies: ['Interactive Narrative', 'Web Game'], live_url: '', github_url: '' },
  { title: 'EVENTRA', category: 'WEB', status: '', sort_order: 1, description: 'An event-hosting and organizer application.', details: 'EVENTRA is an event-hosting and organizer application.', technologies: ['Web App'], live_url: '', github_url: 'https://github.com/farixhere/eventra-updated' },
  PROOFCHECK
];

/* Load every table independently so one failure never blanks the site. */
export async function loadAll(){
  if (!sb){
    data.projects = [...FALLBACK_PROJECTS];
    data.loaded = true; data.failed = -1;
    emit('data', data);
    return data;
  }
  const q = {
    profile:     () => sb.from('profile').select('*').eq('id', 1).maybeSingle(),
    skills:      () => sb.from('skills').select('*').order('sort_order'),
    experiments: () => sb.from('experiments').select('*').order('sort_order'),
    projects:    () => sb.from('projects').select('*').order('sort_order'),
    posts:       () => sb.from('posts').select('*').eq('published', true).order('published_at', { ascending: false }),
    faq:         () => sb.from('faq').select('*').order('sort_order')
  };
  const names = Object.keys(q);
  const res = await Promise.allSettled(names.map(n => q[n]()));
  const d = {}; let failed = 0;
  res.forEach((r, i) => {
    const ok = r.status === 'fulfilled' && !r.value.error;
    if (!ok) failed++;
    d[names[i]] = ok ? (r.value.data ?? (names[i] === 'profile' ? null : [])) : (names[i] === 'profile' ? null : []);
  });
  if (d.profile) data.profile = { ...data.profile, ...Object.fromEntries(Object.entries(d.profile).filter(([, v]) => v != null && v !== '')) };
  data.skills = d.skills; data.experiments = d.experiments; data.posts = d.posts; data.faq = d.faq;

  let rows = d.projects.length ? [...d.projects] : [...FALLBACK_PROJECTS];
  /* The brief features PROOFCHECK; show it honestly as a concept unless it is already in the dashboard. */
  if (!rows.some(r => /proofcheck/i.test(r.title || ''))) rows.push(PROOFCHECK);
  data.projects = rows;
  data.failed = failed; data.loaded = true;
  emit('data', data);
  return data;
}
