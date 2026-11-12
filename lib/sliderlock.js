/**
 * Slider lock: range inputs in settings panels are easy to nudge by accident
 * while scrolling on a phone. When locked, pointer interaction on sliders is
 * swallowed; the number boxes next to them keep working. A floating pill
 * toggles the lock while a panel is open.
 */
import { settings, set as setSetting } from './settings.js';
import { t, toast } from './st.js';

let unlocked = false;
let pill = null;
let hintAt = 0;
let observer = null;

function isLockedTarget(target) {
    if (!(target instanceof HTMLInputElement) || target.type !== 'range') return false;
    if (target.closest('[data-mmu-free]')) return false;
    return locked();
}

export function locked() {
    // Phone layout only: with a mouse, sliders are not nudged by accident while scrolling.
    const body = document.body;
    if (body.classList.contains('mmu-desktop') && !settings().desktop?.lockSliders) return false;
    return body.classList.contains('mmu-on') && settings().sliders.lockByDefault && !unlocked;
}

function block(ev) {
    if (!isLockedTarget(ev.target)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (ev.type === 'pointerdown' || ev.type === 'touchstart') hint();
}

function hint() {
    const now = Date.now();
    if (now - hintAt < 2500) return;
    hintAt = now;
    toast()?.info(t`Sliders are locked. Tap the lock button to adjust them, or type into the number box.`, t`Slider lock`, { timeOut: 2500 });
    pill?.classList.add('is-nudge');
    setTimeout(() => pill?.classList.remove('is-nudge'), 600);
}

function onFocus(ev) {
    if (isLockedTarget(ev.target)) ev.target.blur();
}

export function setUnlocked(state) {
    unlocked = !!state;
    render();
}

export function toggle() {
    setUnlocked(!unlocked);
    toast()?.info(unlocked ? t`Sliders unlocked` : t`Sliders locked`, '', { timeOut: 1200 });
}

function anyPanelOpen() {
    return !!document.querySelector('.drawer-content.openDrawer, #character_popup:not([style*="display: none"]), .popup[open]');
}

function render() {
    const s = settings().sliders;
    document.body.classList.toggle('mmu-sliders-locked', locked());
    if (!pill) return;
    const lockApplies = !document.body.classList.contains('mmu-desktop') || !!settings().desktop?.lockSliders;
    const visible = document.body.classList.contains('mmu-on') && lockApplies && s.lockByDefault && s.showPill && anyPanelOpen();
    pill.classList.toggle('is-visible', visible);
    pill.classList.toggle('is-unlocked', unlocked);
    pill.querySelector('i').className = `fa-solid ${unlocked ? 'fa-lock-open' : 'fa-lock'}`;
    pill.querySelector('span').textContent = unlocked ? t`Sliders free` : t`Sliders locked`;
    pill.title = unlocked ? t`Tap to lock sliders again` : t`Tap to unlock sliders`;
}

export function mount() {
    if (pill) return;
    pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'mmu-slider-lock';
    pill.innerHTML = '<i class="fa-solid fa-lock"></i><span></span>';
    pill.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); toggle(); });
    document.body.append(pill);

    document.addEventListener('pointerdown', block, { capture: true });
    document.addEventListener('mousedown', block, { capture: true });
    document.addEventListener('touchstart', block, { capture: true, passive: false });
    document.addEventListener('focusin', onFocus, { capture: true });

    // Watch drawer open/close to show the pill and to re-lock.
    observer = new MutationObserver(() => {
        const open = anyPanelOpen();
        if (!open && unlocked && settings().sliders.relockOnClose) unlocked = false;
        render();
    });
    const holder = document.getElementById('top-settings-holder');
    if (holder) observer.observe(holder, { attributes: true, attributeFilter: ['class'], subtree: true });
    const charPopup = document.getElementById('character_popup');
    if (charPopup) observer.observe(charPopup, { attributes: true, attributeFilter: ['style', 'class'] });
    observer.observe(document.body, { childList: true });
    render();
}

export function refresh() {
    render();
}

document.addEventListener('mmu:theme-applied', () => render());

export { setSetting };
