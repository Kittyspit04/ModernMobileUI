/**
 * Mobile layout features (replacing the Mobilyze extension):
 *  - auto-hiding top bar with three reveal triggers (scroll up, pull-tab, edge swipe)
 *  - message navigation pill (step through messages)
 *  - tablet centering with a maximum chat width
 *  - chat density (comfortable row layout or compact full-width bubbles)
 */
import { settings, set as setSetting } from './settings.js';
import { events, t, toast } from './st.js';

const body = document.body;
let hideTimer = null;
let lastScrollTop = 0;
let pullTab = null;
let jumpPill = null;
let mounted = false;
let touchStartY = null;
let barHovered = false;

export function mobilyzeDetected() {
    return body.classList.contains('mobilyze-active') || !!document.getElementById('mobilyze-pull-tab');
}

function chatEl() { return document.getElementById('chat'); }
function anyDrawerOpen() { return !!document.querySelector('.drawer-content.openDrawer'); }
function hasChat() { const c = chatEl(); return !!c && !c.querySelector('.welcomePanel') && !!c.querySelector('.mes'); }
function autoBarOn() { return body.classList.contains('mmu-autobar'); }

/* ---------------------------------------------------------------- */
/* Top bar                                                           */
/* ---------------------------------------------------------------- */

export function showBar({ schedule = true } = {}) {
    body.classList.remove('mmu-bar-hidden');
    clearTimeout(hideTimer);
    if (schedule) scheduleHide();
}

export function hideBar({ fromScroll = false } = {}) {
    if (!autoBarOn()) return;
    if (anyDrawerOpen() || !hasChat()) return;
    if (barHovered && !fromScroll) return; // a mouse resting on the bar only delays the timed hide
    body.classList.add('mmu-bar-hidden');
    clearTimeout(hideTimer);
}

function scheduleHide() {
    clearTimeout(hideTimer);
    const delay = Number(settings().layout.autoHideDelay) || 0;
    if (!autoBarOn() || delay <= 0) return;
    hideTimer = setTimeout(() => {
        const c = chatEl();
        if (c && c.scrollTop < 40) return; // reading the very top: keep the bar
        hideBar();
    }, delay);
}

function onChatScroll() {
    if (!autoBarOn()) return;
    const c = chatEl();
    if (!c) return;
    const top = c.scrollTop;
    const delta = top - lastScrollTop;
    lastScrollTop = top;
    if (Math.abs(delta) < 14) return;
    if (delta > 0 && top > 60) hideBar({ fromScroll: true });
    else if (delta < 0 && settings().layout.revealScroll) showBar();
}

function onTouchStart(ev) {
    if (!autoBarOn() || !settings().layout.revealEdgeSwipe) { touchStartY = null; return; }
    const y = ev.touches?.[0]?.clientY ?? null;
    touchStartY = (y !== null && y <= 28 && body.classList.contains('mmu-bar-hidden')) ? y : null;
}

function onTouchMove(ev) {
    if (touchStartY === null) return;
    const y = ev.touches?.[0]?.clientY ?? 0;
    if (y - touchStartY > 40) { touchStartY = null; showBar(); }
}

function buildPullTab() {
    pullTab = document.createElement('button');
    pullTab.type = 'button';
    pullTab.id = 'mmu-pull-tab';
    pullTab.title = t`Show the menu bar`;
    pullTab.setAttribute('aria-label', t`Show the menu bar`);
    pullTab.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    let startY = null;
    pullTab.addEventListener('pointerdown', (ev) => { startY = ev.clientY; });
    pullTab.addEventListener('pointermove', (ev) => { if (startY !== null && ev.clientY - startY > 18) { startY = null; showBar(); } });
    pullTab.addEventListener('pointerup', () => { startY = null; });
    pullTab.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); showBar(); });
    body.append(pullTab);
}

/* ---------------------------------------------------------------- */
/* Message navigation pill                                           */
/* ---------------------------------------------------------------- */

function messageTops() {
    const c = chatEl();
    if (!c) return [];
    return [...c.querySelectorAll(':scope > .mes')].map(el => ({ el, top: el.offsetTop }));
}

function jump(direction) {
    const c = chatEl();
    if (!c) return;
    const list = messageTops();
    if (!list.length) return;
    const current = c.scrollTop + 4;
    let target = null;
    if (direction < 0) {
        const prev = list.filter(x => x.top < current - 8);
        target = prev.length ? prev[prev.length - 1] : list[0];
    } else {
        const next = list.filter(x => x.top > current + 8);
        target = next.length ? next[0] : null;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !settings().animations;
    if (target) c.scrollTo({ top: Math.max(0, target.top - 6), behavior: reduced ? 'auto' : 'smooth' });
    else c.scrollTo({ top: c.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    pulse(direction < 0 ? 'up' : 'down');
}

function pulse(which) {
    const btn = jumpPill?.querySelector(`[data-dir="${which}"]`);
    if (!btn) return;
    btn.classList.remove('is-pulse'); void btn.offsetWidth; btn.classList.add('is-pulse');
}

function buildJumpPill() {
    jumpPill = document.createElement('div');
    jumpPill.id = 'mmu-jump';
    jumpPill.innerHTML = '<button type="button" data-dir="up" aria-label="Previous message"><i class="fa-solid fa-chevron-up"></i></button><button type="button" data-dir="down" aria-label="Next message"><i class="fa-solid fa-chevron-down"></i></button>';
    jumpPill.querySelector('[data-dir="up"]').title = t`Previous message`;
    jumpPill.querySelector('[data-dir="down"]').title = t`Next message`;
    jumpPill.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); jump(b.dataset.dir === 'up' ? -1 : 1); });
    jumpPill.addEventListener('pointerdown', ev => ev.stopPropagation());
    body.append(jumpPill);
}

/* ---------------------------------------------------------------- */
/* Apply settings                                                    */
/* ---------------------------------------------------------------- */

export function apply() {
    const s = settings().layout;
    const themeOn = body.classList.contains('mmu-on');
    const conflict = mobilyzeDetected();
    const autobar = themeOn && s.autoHideBar && !conflict;
    body.classList.toggle('mmu-autobar', autobar);
    if (!autobar) showBar({ schedule: false });
    body.classList.toggle('mmu-jump-on', themeOn && s.jumpButtons && !conflict && hasChat());
    body.classList.toggle('mmu-tablet', themeOn && Number(s.tabletMaxWidth) > 0);
    body.style.setProperty('--mmu-max-width', Number(s.tabletMaxWidth) > 0 ? `${Number(s.tabletMaxWidth)}px` : '100dvw');
    body.dataset.mmuDensity = s.density || 'comfortable';
    body.dataset.mmuTab = s.pullTab || 'standard';
    body.classList.toggle('mmu-mobilyze-conflict', themeOn && conflict);
    if (autobar) scheduleHide();
}

/** Keep at least one reveal trigger on so the bar can never get stuck. */
export function ensureRevealTrigger() {
    const s = settings().layout;
    if (!s.revealScroll && !s.revealPullTab && !s.revealEdgeSwipe) {
        setSetting('layout.revealPullTab', true);
        toast()?.info(t`At least one way to reveal the menu bar must stay enabled. The pull-tab was turned back on.`, '', { timeOut: 3000 });
        return false;
    }
    return true;
}

export function mount() {
    if (mounted) return;
    mounted = true;
    buildPullTab();
    buildJumpPill();
    const c = chatEl();
    if (c) c.addEventListener('scroll', onChatScroll, { passive: true });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    const holder = document.getElementById('top-settings-holder');
    if (holder) {
        holder.addEventListener('mouseenter', (ev) => { if (ev.sourceCapabilities?.firesTouchEvents) return; barHovered = true; });
        holder.addEventListener('mouseleave', () => { barHovered = false; scheduleHide(); });
        new MutationObserver(() => { if (anyDrawerOpen()) showBar({ schedule: false }); else scheduleHide(); }).observe(holder, { attributes: true, attributeFilter: ['class'], subtree: true });
    }
    const { source, types } = events();
    const refresh = () => { lastScrollTop = 0; showBar({ schedule: false }); apply(); };
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, refresh);
    if (types.APP_READY) source.on(types.APP_READY, refresh);
    window.addEventListener('resize', () => apply());
    document.addEventListener('mmu:theme-applied', () => apply());
    if (mobilyzeDetected()) {
        console.warn('[ModernMobileUI] Mobilyze detected: auto-hide bar and message navigation stay off to avoid conflicts.');
    }
    apply();
}
