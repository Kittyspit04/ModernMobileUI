/**
 * Swipe controls:
 *  - "Swipe only with the arrows": SillyTavern's touch gestures (swiping across the chat)
 *    no longer change the reply. The arrow buttons, keyboard and /swipe still do.
 *  - Swipe bar: arrows, swipe counter and the "Thought for…" field in one row under the name.
 *  - Bigger arrows.
 * The layout parts are pure CSS on SillyTavern's own elements (style.css section 14), so
 * SillyTavern keeps doing the swiping, overswipe generation and the swipe picker itself.
 */
import { settings } from './settings.js';

function swipes() {
    return settings().swipes ?? {};
}

/** SillyTavern turns a touch swipe into "swiped-left"/"swiped-right" events that bubble to
 * document, where it listens. Stopping them on the way down keeps them from swiping. */
function blockGesture(event) {
    const s = settings();
    if (!s.enabled || !swipes().buttonsOnly) return;
    const target = event.target;
    if (target instanceof Element && !target.closest('#sheld')) return;
    event.stopImmediatePropagation();
}

export function apply() {
    const body = document.body;
    const on = body.classList.contains('mmu-on');
    const s = swipes();
    body.classList.toggle('mmu-swipebar', on && !!s.bar);
    body.classList.toggle('mmu-swipe-big', on && !!s.bigButtons);
}

export function mount() {
    window.addEventListener('swiped-left', blockGesture, true);
    window.addEventListener('swiped-right', blockGesture, true);
    document.addEventListener('mmu:theme-applied', apply);
    apply();
}
