/**
 * Backgrounds per chat and per character.
 *
 * Resolution order: this chat > this character/group > SillyTavern's global background.
 *  - Chat: SillyTavern's own chat background lock (chat metadata "custom_background"),
 *    so it is the same setting as the lock in the Backgrounds panel and /lockbg.
 *  - Character or group: stored by this extension next to the character theme.
 *  - Otherwise SillyTavern's global background.
 *
 * Values are CSS url() strings in the exact format SillyTavern stores.
 */
import { ctx, t, toast } from './st.js';
import { settings, save } from './settings.js';
import { owner, chatOpen, onChatChanged } from './chattheme.js';

const LOCK_KEY = 'custom_background';
const CHAT_LIST_KEY = 'chat_backgrounds';
let stModule;
let lastPanelClick = 0;
let applied = null;
let hintShown = false;

async function backgroundsModule() {
    if (stModule === undefined) {
        try {
            // .../scripts/extensions/third-party/ModernMobileUI/lib -> .../scripts/backgrounds.js
            stModule = await import('../../../../backgrounds.js');
        } catch {
            stModule = null;
        }
    }
    return stModule;
}

/** CSS value for a file in the user's backgrounds folder. */
export function cssUrlForFile(filename) {
    return `url("backgrounds/${encodeURIComponent(filename)}")`;
}

/** CSS value for a background uploaded to a chat. */
export function cssUrlForChatFile(path) {
    return `url("${encodeURI(path)}")`;
}

function sameUrl(a, b) {
    const norm = (v) => String(v ?? '').replace(/\\(.)/g, '$1').replace(/^url\((['"]?)(.*)\1\)$/, '$2');
    try { return decodeURI(norm(a)) === decodeURI(norm(b)); } catch { return norm(a) === norm(b); }
}

/** SillyTavern's global background (CSS url()), or null if unknown. */
export function globalBackground() {
    return stModule?.background_settings?.url ?? null;
}

export function chatBackground() {
    if (!chatOpen()) return null;
    return ctx().chatMetadata?.[LOCK_KEY] || null;
}

function characterBackgroundsOn() {
    const s = settings();
    return !!(s.enabled && s.perChatThemes);
}

/** The stored character/group background, whether or not it is in use. */
export function characterBackground() {
    const o = owner();
    if (!o) return null;
    return settings().characterThemes?.[o.key]?.background || null;
}

/** What should be visible in the open chat: chat lock, then character, then null (= global). */
function wanted() {
    if (!chatOpen()) return null;
    return chatBackground() || (characterBackgroundsOn() ? characterBackground() : null);
}

/** Where the visible background comes from right now. */
export function backgroundSource() {
    if (!chatOpen()) return 'default';
    if (chatBackground()) return 'chat';
    if (characterBackgroundsOn() && characterBackground()) return 'character';
    return 'default';
}

/** The background a scope falls back to when it sets none itself. */
export function inheritedBackground(scope) {
    if (scope === 'chat' && characterBackgroundsOn() && characterBackground()) return { url: characterBackground(), source: 'character' };
    return { url: globalBackground(), source: 'default' };
}

function bgElement() {
    return document.getElementById('bg1');
}

/** Keep the lock marker in SillyTavern's Backgrounds panel in sync with the chat lock. */
function syncPanel() {
    const locked = chatBackground();
    for (const tile of document.querySelectorAll('.bg_example')) {
        const file = tile.getAttribute('bgfile');
        if (!file) continue;
        const url = tile.getAttribute('custom') === 'true' ? cssUrlForChatFile(file) : cssUrlForFile(file);
        tile.classList.toggle('locked-background', !!locked && sameUrl(url, locked));
    }
}

/**
 * Put the right background on screen for the open chat. Without a chat or character
 * background it only steps in to undo one it showed itself, so other tools that set
 * the background (and the start screen) are left alone.
 */
export function show() {
    const el = bgElement();
    if (!el) return;
    const want = wanted();
    if (want) {
        if (!sameUrl(el.style.backgroundImage, want)) el.style.backgroundImage = want;
        applied = want;
        return;
    }
    const global = globalBackground();
    if (applied && global && sameUrl(el.style.backgroundImage, applied)) el.style.backgroundImage = global;
    applied = null;
}

/** Lock a background to the open chat (null removes the lock). */
export function setChatBackground(url) {
    if (!chatOpen()) return false;
    const c = ctx();
    if (!c.chatMetadata) return false;
    if (url) c.chatMetadata[LOCK_KEY] = url;
    else delete c.chatMetadata[LOCK_KEY];
    c.saveMetadataDebounced();
    show();
    syncPanel();
    return true;
}

/** Background for every chat with the open character or group (null removes it). */
export function setCharacterBackground(url) {
    const o = owner();
    if (!o) return false;
    const s = settings();
    if (!s.characterThemes || typeof s.characterThemes !== 'object') s.characterThemes = {};
    const current = { ...(s.characterThemes[o.key] ?? {}) };
    if (url) current.background = url;
    else delete current.background;
    if (Object.keys(current).length) s.characterThemes[o.key] = current;
    else delete s.characterThemes[o.key];
    save();
    show();
    return true;
}

export function characterBackgroundCount() {
    return Object.values(settings().characterThemes ?? {}).filter(v => v?.background).length;
}

/**
 * Backgrounds to choose from: this chat's uploaded backgrounds first, then the
 * backgrounds folder.
 * @returns {Promise<Array<{ file: string, label: string, url: string, thumb: string, chat?: boolean }>>}
 */
export async function listBackgrounds() {
    const c = ctx();
    const out = [];
    const chatList = c.chatMetadata?.[CHAT_LIST_KEY];
    if (chatOpen() && Array.isArray(chatList)) {
        for (const path of chatList) {
            if (typeof path !== 'string' || !path) continue;
            const name = path.split('/').pop() ?? path;
            out.push({ file: name, label: name.replace(/\.[^.]+$/, ''), url: cssUrlForChatFile(path), thumb: encodeURI(path), chat: true });
        }
    }
    const response = await fetch('/api/backgrounds/all', { method: 'POST', headers: c.getRequestHeaders(), body: JSON.stringify({}) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const images = Array.isArray(data) ? data : (data?.images ?? []);
    for (const image of images) {
        const name = typeof image === 'string' ? image : image?.filename;
        if (!name || name.startsWith('__transparent')) continue;
        out.push({ file: name, label: name.replace(/\.[^.]+$/, ''), url: cssUrlForFile(name), thumb: c.getThumbnailUrl('bg', name) });
    }
    return out;
}

/** Thumbnail address for a stored CSS url() value. */
export function thumbForUrl(url) {
    const match = String(url ?? '').match(/^url\((['"]?)(.*)\1\)$/);
    if (!match) return null;
    const path = match[2];
    if (!path || /__transparent/.test(path)) return null;
    const system = path.match(/^backgrounds\/(.+)$/);
    if (system) {
        try { return ctx().getThumbnailUrl('bg', decodeURIComponent(system[1])); } catch { return path; }
    }
    return path;
}

export function labelForUrl(url) {
    const match = String(url ?? '').match(/^url\((['"]?)(.*)\1\)$/);
    if (!match || /__transparent/.test(match[2])) return t`None`;
    let name = match[2].split('/').pop() ?? '';
    try { name = decodeURIComponent(name); } catch { /* keep */ }
    return name.replace(/\.[^.]+$/, '') || t`None`;
}

export function mount() {
    void backgroundsModule().then(() => show());

    // SillyTavern shows the chat lock or the global background when a chat opens, and the
    // global one again after an unlock or a pick in its panel. Where this character has a
    // background of its own (and the chat no lock), put that one back. Chat locks are
    // SillyTavern's own and are left to it.
    const watch = () => {
        const el = bgElement();
        if (!el) return false;
        new MutationObserver(() => {
            if (!chatOpen() || chatBackground() || !characterBackgroundsOn()) return;
            const want = characterBackground();
            if (!want || sameUrl(el.style.backgroundImage, want)) return;
            el.style.backgroundImage = want;
            applied = want;
            if (!hintShown && Date.now() - lastPanelClick < 1500 && !chatBackground()) {
                hintShown = true;
                toast()?.info(t`This character has its own background (Chat theme). The global background changed for other chats. Lock a background to give just this chat another one.`);
            }
        }).observe(el, { attributes: true, attributeFilter: ['style'] });
        return true;
    };
    if (!watch()) {
        const wait = new MutationObserver(() => { if (watch()) wait.disconnect(); });
        wait.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('click', (e) => {
        if (e.target instanceof Element && e.target.closest('.bg_example')) lastPanelClick = Date.now();
    }, true);
    onChatChanged(() => show());
    // Settings changes (per-chat themes on/off, extension on/off, cleared character themes).
    document.addEventListener('mmu:theme-applied', () => show());
}
