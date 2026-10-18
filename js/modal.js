/* ==========================================================================
   Modals: focus trap, Esc, backdrop, scroll-lock, focus return.
   Behaviour is unchanged from the original site; `onClose` hooks were added
   so games / consoles can release their resources when a modal closes.
   ========================================================================== */
import { $, $$ } from './util.js';

let activeModal = null, lastFocus = null, closeHook = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const getActiveModal = () => activeModal;

export function openModal(el, focusSel, onClose){
  if (activeModal) closeModal(true);
  lastFocus = document.activeElement;
  activeModal = el; closeHook = onClose || null;
  el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const target = (focusSel && $(focusSel, el)) || $('[data-close]', el) || $(FOCUSABLE, el);
  setTimeout(() => target?.focus({ preventScroll: true }), 30);
}

export function closeModal(silent){
  if (!activeModal) return;
  const el = activeModal, hook = closeHook;
  el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  const back = lastFocus; activeModal = null; lastFocus = null; closeHook = null;
  try { hook?.(); } catch (e) { console.error(e); }
  if (!silent) back?.focus?.({ preventScroll: true });
}

export function initModals(){
  document.addEventListener('keydown', e => {
    if (!activeModal) return;
    if (e.key === 'Escape'){
      /* let a game inside the modal consume Esc first if it asked to */
      if (e.defaultPrevented) return;
      e.preventDefault(); closeModal(); return;
    }
    if (e.key !== 'Tab') return;
    const f = $$(FOCUSABLE, activeModal).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  $$('.modal').forEach(m => {
    m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
    $$('[data-close]', m).forEach(b => b.addEventListener('click', () => closeModal()));
  });
}
