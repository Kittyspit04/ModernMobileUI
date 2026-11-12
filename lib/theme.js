/**
 * Applies the theme: body classes, data attributes and CSS custom properties
 * derived from the settings. Everything visual lives in style.css and keys
 * off these hooks, so toggling settings never needs a reload.
 */
import { settings } from './settings.js';
import { isMobileLayout, events, ctx } from './st.js';

const FONT_STACKS = {
    onest: "'Onest', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

let fontLinkAdded = false;

function ensureFont() {
    if (fontLinkAdded) return;
    fontLinkAdded = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap';
    link.id = 'mmu-font-onest';
    document.head.append(link);
}

export function apply() {
    const s = settings();
    const body = document.body;
    const active = s.enabled && (isMobileLayout() || s.desktopToo);

    body.classList.toggle('mmu-on', active);
    body.classList.toggle('mmu-anim', active && s.animations);
    body.classList.toggle('mmu-word-reveal', active && s.animations && s.wordReveal);
    body.classList.toggle('mmu-think', active && s.thinkingIndicator);
    body.classList.toggle('mmu-ignore-rm', !!s.ignoreReducedMotion);
    body.classList.toggle('mmu-override-colors', active && s.overrideThemeColors);
    body.classList.toggle('mmu-name-badge', active && s.showNameBadge && !!s.nameBadge);
    body.dataset.mmuMode = s.mode;
    body.dataset.mmuChat = s.chatLayout;
    body.dataset.mmuMotion = s.animationIntensity;

    const style = body.style;
    style.setProperty('--mmu-accent', s.accent);
    style.setProperty('--mmu-radius', `${Number(s.radius) || 18}px`);
    style.setProperty('--mmu-avatar', `${Number(s.avatarSize) || 34}px`);
    style.setProperty('--mmu-badge-text', JSON.stringify(String(s.nameBadge || '')));
    style.setProperty('--mmu-greeting', JSON.stringify(String(s.homeGreeting || '')));
    body.classList.toggle('mmu-greeting', active && !!s.homeGreeting);

    if (s.font === 'onest') {
        ensureFont();
        style.setProperty('--mmu-font', FONT_STACKS.onest);
        body.classList.add('mmu-font');
    } else if (s.font === 'system') {
        style.setProperty('--mmu-font', FONT_STACKS.system);
        body.classList.add('mmu-font');
    } else {
        body.classList.remove('mmu-font');
    }

    colorizeMessages();
    document.dispatchEvent(new CustomEvent('mmu:theme-applied'));
}

/* ---------- per-character hue for the colourful layout ---------- */

function hueOf(name) {
    let hash = 0;
    for (const ch of String(name || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return hash % 360;
}

export function colorizeMessages(root = document) {
    const s = settings();
    const on = s.chatLayout === 'colorful' && s.perCharacterHue;
    const nodes = root.querySelectorAll ? root.querySelectorAll('#chat .mes') : [];
    for (const el of nodes) {
        if (!on) { el.style.removeProperty('--mmu-char-hue'); continue; }
        if (el.getAttribute('is_user') === 'true') continue;
        const name = el.getAttribute('ch_name') || '';
        el.style.setProperty('--mmu-char-hue', String(hueOf(name)));
    }
}

let observer = null;

export function watch() {
    const chat = document.getElementById('chat');
    if (chat && !observer) {
        observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node instanceof HTMLElement) {
                        if (node.classList.contains('mes')) colorizeMessages(node.parentElement ?? document);
                        else if (node.querySelector?.('.mes')) colorizeMessages(node);
                    }
                }
            }
        });
        observer.observe(chat, { childList: true });
    }
    const { source, types } = events();
    source.on(types.CHAT_CHANGED, () => setTimeout(() => colorizeMessages(), 50));
    window.addEventListener('resize', debounce(apply, 200));
}

function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export { ctx };

/* ---------- thinking / streaming state for the chat animations ---------- */

let genObserver = null;

function clearGenerationClasses() {
    document.body.classList.remove('mmu-generating');
    document.querySelectorAll('#chat .mes.mmu-thinking, #chat .mes.mmu-streaming').forEach(el => el.classList.remove('mmu-thinking', 'mmu-streaming'));
}

function updateGenerationState() {
    const chat = document.getElementById('chat');
    if (!chat || !document.body.classList.contains('mmu-generating')) return;
    const last = chat.querySelector('.mes.last_mes');
    chat.querySelectorAll('.mes.mmu-thinking, .mes.mmu-streaming').forEach(el => { if (el !== last) el.classList.remove('mmu-thinking', 'mmu-streaming'); });
    if (!last || last.getAttribute('is_user') === 'true') return;
    const text = (last.querySelector('.mes_text')?.textContent ?? '').trim();
    const thinking = text === '' || text === '...' || text === '…';
    last.classList.toggle('mmu-thinking', thinking);
    last.classList.toggle('mmu-streaming', !thinking);
}

function onGenerationStart() {
    document.body.classList.add('mmu-generating');
    const chat = document.getElementById('chat');
    if (chat && !genObserver) {
        genObserver = new MutationObserver(() => updateGenerationState());
    }
    if (chat) genObserver.observe(chat, { childList: true, subtree: true, characterData: true });
    updateGenerationState();
}

function onGenerationEnd() {
    genObserver?.disconnect();
    clearGenerationClasses();
}

export function watchGeneration() {
    const { source, types } = events();
    if (types.GENERATION_STARTED) source.on(types.GENERATION_STARTED, onGenerationStart);
    if (types.GENERATION_AFTER_COMMANDS) source.on(types.GENERATION_AFTER_COMMANDS, onGenerationStart);
    if (types.GENERATION_ENDED) source.on(types.GENERATION_ENDED, onGenerationEnd);
    if (types.GENERATION_STOPPED) source.on(types.GENERATION_STOPPED, onGenerationEnd);
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, onGenerationEnd);
    // Fallback: mirror the core's own flag in case an event is missed.
    new MutationObserver(() => {
        const on = document.body.dataset.generating === 'true';
        if (on && !document.body.classList.contains('mmu-generating')) onGenerationStart();
        if (!on && document.body.classList.contains('mmu-generating')) onGenerationEnd();
    }).observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
}
