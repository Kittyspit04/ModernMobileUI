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
    style.setProperty('--mmu-glass-alpha', String(Math.max(0, Math.min(100, Number(s.glass?.opacity ?? 35))) / 100));
    style.setProperty('--mmu-glass-blur', `${Math.max(0, Math.min(60, Number(s.glass?.blur ?? 16)))}px`);
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
/*
 * SillyTavern emits GENERATION_STARTED for every prompt build, including dry runs
 * (token counting, prompt previews, extensions) and slash commands typed into the
 * input box. Those never show the stop button and never emit GENERATION_ENDED, so
 * the start event alone would leave the indicator stuck.
 *
 * The reliable signal is body[data-generating="true"]: SillyTavern sets it only when
 * a request is actually sent and removes it when the request finishes or is stopped.
 * The start event is only used to learn the generation type, so background ("quiet")
 * generations and impersonation, which do not write a chat message, stay silent.
 */

let genObserver = null;
let lastStart = null;      // { type, quietToLoud, at } of the last non-dry-run start
let indicatorOn = false;

function isGenerating() {
    return document.body.dataset.generating === 'true';
}

/** Does the running generation write into the chat (so the last message should animate)? */
function writesToChat() {
    if (!lastStart || Date.now() - lastStart.at > 60000) return true;
    if (lastStart.type === 'impersonate') return false;
    if (lastStart.type === 'quiet' && !lastStart.quietToLoud) return false;
    return true;
}

function clearGenerationClasses() {
    document.body.classList.remove('mmu-generating');
    document.querySelectorAll('#chat .mes.mmu-thinking, #chat .mes.mmu-streaming').forEach(el => el.classList.remove('mmu-thinking', 'mmu-streaming'));
}

function updateGenerationState() {
    const chat = document.getElementById('chat');
    if (!chat || !indicatorOn) return;
    const last = chat.querySelector('.mes.last_mes');
    chat.querySelectorAll('.mes.mmu-thinking, .mes.mmu-streaming').forEach(el => { if (el !== last) el.classList.remove('mmu-thinking', 'mmu-streaming'); });
    if (!last || last.getAttribute('is_user') === 'true') return;
    const text = (last.querySelector('.mes_text')?.textContent ?? '').trim();
    const thinking = text === '' || text === '...' || text === '…';
    last.classList.toggle('mmu-thinking', thinking);
    last.classList.toggle('mmu-streaming', !thinking);
}

function startIndicator() {
    if (indicatorOn) return;
    if (!writesToChat()) return;
    indicatorOn = true;
    document.body.classList.add('mmu-generating');
    const chat = document.getElementById('chat');
    if (chat) {
        if (!genObserver) genObserver = new MutationObserver(() => updateGenerationState());
        genObserver.observe(chat, { childList: true, subtree: true, characterData: true });
    }
    updateGenerationState();
}

function stopIndicator() {
    indicatorOn = false;
    genObserver?.disconnect();
    clearGenerationClasses();
}

/** Bring the indicator in line with SillyTavern's own generating flag. */
function syncIndicator() {
    if (isGenerating()) startIndicator();
    else stopIndicator();
}

export function watchGeneration() {
    const { source, types } = events();
    if (types.GENERATION_STARTED) {
        source.on(types.GENERATION_STARTED, (type, params, dryRun) => {
            if (dryRun) return; // prompt building only, nothing is sent
            lastStart = { type: String(type ?? 'normal'), quietToLoud: !!params?.quietToLoud, at: Date.now() };
        });
    }
    // End events only trigger a re-check: in group chats the flag stays set between speakers.
    const recheck = () => setTimeout(syncIndicator, 0);
    if (types.GENERATION_ENDED) source.on(types.GENERATION_ENDED, recheck);
    if (types.GENERATION_STOPPED) source.on(types.GENERATION_STOPPED, recheck);
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, () => { stopIndicator(); recheck(); });
    new MutationObserver(syncIndicator).observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
    syncIndicator();
}
