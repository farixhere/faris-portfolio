/* Generative project artwork (designed placeholders, not screenshots). Shared by the
   portfolio project cards and the XIRAF Projects app. */
import { esc, safeUrl } from './util.js';

const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

const ART = {
  echo: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="400" height="300" fill="#141414"/>
    <g fill="none" stroke="#3159E8">
      <circle cx="270" cy="128" r="34" stroke-opacity=".95"/><circle cx="270" cy="128" r="66" stroke-opacity=".7"/>
      <circle cx="270" cy="128" r="102" stroke-opacity=".5"/><circle cx="270" cy="128" r="142" stroke-opacity=".32"/>
      <circle cx="270" cy="128" r="188" stroke-opacity=".18"/><circle cx="270" cy="128" r="238" stroke-opacity=".1"/>
    </g>
    <circle cx="270" cy="128" r="17" fill="#E89A64"/>
    <g fill="#F7F5EF" opacity=".75"><circle cx="46" cy="40" r="1.4"/><circle cx="110" cy="74" r="1"/><circle cx="170" cy="30" r="1.2"/><circle cx="352" cy="38" r="1.2"/><circle cx="80" cy="118" r="1"/><circle cx="196" cy="96" r="1.1"/></g>
    <path d="M0 238 62 196l48 24 62-44 58 54 70-30 100 42V300H0z" fill="#0A0A0A"/>
    <path d="M0 270l70-26 60 18 80-30 70 24 120-14v58H0z" fill="#1d1d1c"/>
  </svg>`,
  eventra: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="400" height="300" fill="#E89A64"/>
    <circle cx="60" cy="250" r="90" fill="#3159E8" opacity=".9"/><rect x="310" y="-30" width="120" height="120" fill="#171717" transform="rotate(18 370 30)"/>
    <g transform="rotate(-5 200 150)">
      <path d="M50 70h200v0a14 14 0 0 0 28 0h72v160H278a14 14 0 0 0-28 0H50z" fill="#F7F5EF" stroke="#171717" stroke-width="2"/>
      <path d="M264 84v132" stroke="#171717" stroke-width="2" stroke-dasharray="3 6"/>
      <rect x="72" y="94" width="100" height="12" fill="#171717"/><rect x="72" y="116" width="150" height="6" fill="#171717" opacity=".35"/>
      <rect x="72" y="140" width="64" height="26" fill="#3159E8"/><rect x="144" y="140" width="64" height="26" fill="none" stroke="#171717" stroke-width="1.5"/>
      <rect x="72" y="178" width="150" height="6" fill="#171717" opacity=".35"/><rect x="72" y="192" width="104" height="6" fill="#171717" opacity=".35"/>
      <circle cx="318" cy="132" r="26" fill="#3159E8"/><path d="M292 190a26 26 0 0 1 52 0z" fill="#171717"/>
    </g>
  </svg>`,
  proofcheck: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="400" height="300" fill="#E9E5DB"/>
    <g stroke="#171717" stroke-width="2">
      <rect x="64" y="58" width="190" height="104" fill="#F7F5EF" transform="rotate(-6 160 110)"/>
      <rect x="86" y="86" width="196" height="108" fill="#F7F5EF" transform="rotate(3 184 140)"/>
      <rect x="112" y="118" width="204" height="112" fill="#FFFDF8"/>
    </g>
    <g fill="#171717"><rect x="134" y="144" width="110" height="8" opacity=".85"/><rect x="134" y="162" width="150" height="6" opacity=".3"/><rect x="134" y="176" width="128" height="6" opacity=".3"/><rect x="134" y="190" width="90" height="6" opacity=".3"/></g>
    <circle cx="304" cy="118" r="30" fill="#3159E8"/><path d="m290 118 10 10 18-20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="94" cy="226" r="26" fill="none" stroke="#171717" stroke-width="5"/><path d="m113 245 22 22" stroke="#171717" stroke-width="7" stroke-linecap="round"/>
    <circle cx="344" cy="238" r="9" fill="#E89A64"/>
  </svg>`,
  generic: seed => {
    const h = hash(seed), pal = ['#3159E8', '#E89A64', '#171717'], a = pal[h % 3], b = pal[(h + 1) % 3], c = pal[(h + 2) % 3];
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="300" fill="#E9E5DB"/>
      <circle cx="${110 + h % 90}" cy="${120 + h % 40}" r="${70 + h % 30}" fill="${a}"/>
      <rect x="${200 + h % 60}" y="${60 + h % 50}" width="120" height="120" fill="${b}" transform="rotate(${(h % 40) - 20} 260 120)"/>
      <path d="M40 300v-90a70 70 0 0 1 140 0v90z" fill="none" stroke="${c}" stroke-width="3"/>
      <g fill="#171717"><circle cx="330" cy="248" r="3"/><circle cx="346" cy="248" r="3"/><circle cx="362" cy="248" r="3"/></g>
    </svg>`;
  }
};

export function artFor(p){
  const k = (String(p.title || '') + ' ' + String(p.slug || '')).toLowerCase();
  if (k.includes('echo')) return ART.echo();
  if (k.includes('eventra')) return ART.eventra();
  if (k.includes('proofcheck')) return ART.proofcheck();
  return ART.generic(p.title || 'faris');
}

/* DB image_url sometimes holds a website, not a picture — only trust things that look like images. */
export const looksLikeImage = u => /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(u) || /(googleusercontent|githubusercontent|supabase\.co\/storage|imgur|unsplash|cloudinary|images\.)/i.test(u);

/* Returns markup for a project's media (real image if it looks like one, otherwise designed art). */
export function mediaFor(p, { loading = 'lazy' } = {}){
  const img = safeUrl(p.image_url);
  return img && looksLikeImage(img)
    ? `<img src="${esc(img)}" alt="${esc(p.title)} preview" loading="${loading}" decoding="async" referrerpolicy="no-referrer" data-art>`
    : artFor(p);
}

/* Attach the graceful fallback: a broken image is replaced by the designed art. */
export function armArtFallback(root, getProject){
  root.querySelectorAll('img[data-art]').forEach(img => img.addEventListener('error', () => {
    const p = getProject(img);
    if (p) img.replaceWith(Object.assign(document.createElement('div'), { className: 'art-swap', innerHTML: artFor(p) }));
  }, { once: true }));
}
