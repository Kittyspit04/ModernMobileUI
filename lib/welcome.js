/**
 * Start screen (welcome page) options:
 *  - hide the assistant greeting and/or the shortcut message below the recent chats
 *  - write your own preview text for any recent chat (stored by the extension,
 *    the chat file and its last message are not touched)
 *  - clean up the "last message" previews on the recent chat cards:
 *    run your display-only Regex scripts on them (the same ones the chat uses),
 *    remove [status] header blocks, markup, apply custom replacements,
 *    show more or fewer lines, or hide the preview entirely.
 *
 * The preview text comes from the server as the raw stored message, so scripts
 * that only alter the chat display (for example ones that turn placeholder
 * characters into spaces or render a status header) never reach it. This module
 * fills that gap on the client.
 */
import { settings, save } from './settings.js';
import { ctx, t, toast } from './st.js';

const EMPTY_MARKER = '[The message is empty]';
const PLACEMENT_USER_INPUT = 1;
const PLACEMENT_AI_OUTPUT = 2;

let regexApi = null;
let regexLoaded = null;
let observer = null;

function loadRegex() {
    if (!regexLoaded) {
        // public/scripts/extensions/third-party/ModernMobileUI/lib -> public/scripts/extensions/regex
        regexLoaded = import('../../../regex/engine.js').then(mod => { regexApi = mod; return mod; }).catch(() => null);
    }
    return regexLoaded;
}

/** Display-only regex scripts that apply to chat messages, global + preset + this chat's character. */
function displayScripts(avatar) {
    if (!regexApi) return [];
    const c = ctx();
    const list = [];
    const types = regexApi.SCRIPT_TYPES ?? {};
    for (const type of [types.GLOBAL, types.PRESET]) {
        if (type === undefined) continue;
        try { list.push(...(regexApi.getScriptsByType(type, { allowedOnly: true }) ?? [])); } catch { /* ignore */ }
    }
    // Scoped scripts belong to the chat's character. On the start screen no character is
    // selected, so look them up by the card's avatar and honour the "allowed" list.
    if (avatar) {
        const character = c.characters?.find(x => x.avatar === avatar);
        const scoped = character?.data?.extensions?.regex_scripts;
        const allowed = c.extensionSettings?.character_allowed_regex;
        if (Array.isArray(scoped) && Array.isArray(allowed) && allowed.includes(avatar)) list.push(...scoped);
    }
    return list.filter(s => s && !s.disabled && !s.promptOnly && s.markdownOnly
        && Array.isArray(s.placement) && (s.placement.includes(PLACEMENT_AI_OUTPUT) || s.placement.includes(PLACEMENT_USER_INPUT)));
}

function applyRegexScripts(text, avatar) {
    if (!regexApi?.runRegexScript) return text;
    const character = avatar ? ctx().characters?.find(x => x.avatar === avatar) : null;
    let out = text;
    for (const script of displayScripts(avatar)) {
        try { out = regexApi.runRegexScript(script, out, { characterOverride: character?.name }); } catch { /* a broken script must not break the page */ }
    }
    return out;
}

/** Parse "pattern => replacement" lines. Pattern may be /regex/flags or plain text. */
function parseRules(source) {
    const rules = [];
    for (const rawLine of String(source ?? '').split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const arrow = line.indexOf('=>');
        const pattern = (arrow >= 0 ? line.slice(0, arrow) : line).trim();
        const replacement = arrow >= 0 ? line.slice(arrow + 2).trim() : '';
        if (!pattern) continue;
        try {
            const m = pattern.match(/^\/(.+)\/([a-z]*)$/i);
            const regex = m ? new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g') : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            rules.push({ regex, replacement });
        } catch { /* skip invalid patterns */ }
    }
    return rules;
}

function cleanPreview(raw, avatar) {
    const w = settings().welcome;
    let text = String(raw ?? '');
    if (text.trim() === EMPTY_MARKER) return w.emptyText || '';
    const truncated = text.startsWith('...');
    if (truncated) text = text.slice(3);
    if (w.applyRegex) text = applyRegexScripts(text, avatar);
    for (const rule of parseRules(w.rules)) text = text.replace(rule.regex, rule.replacement);
    text = text.replace(/<[^>]*>/g, ' ');                                  // HTML from display scripts
    if (w.stripStatus) {
        text = text.replace(/^\s*(?:\[[^\]\n]{0,600}\]\s*)+/u, '');      // leading [status] blocks
        text = text.replace(/^\s*\[[^\]\n]*\]\s*$/gmu, '');               // whole-line [status] blocks
    }
    text = text.replace(/(\*\*|__|\*|~~|`)/g, '');                        // markdown emphasis markers
    text = text.replace(/\s+/g, ' ').trim();
    if (!text) return w.emptyText || '';
    return truncated ? `…${text}` : text;
}

/* ---------- per-chat custom preview text ---------- */

/** Stable key for a recent chat: owner (character avatar or group id) + chat file name. */
function cardKey(card) {
    const file = card.getAttribute('data-file') || '';
    const group = card.getAttribute('data-group') || '';
    const avatar = card.getAttribute('data-avatar') || '';
    return group ? `group:${group}::${file}` : `${avatar}::${file}`;
}

function ownerOf(key) {
    const i = key.indexOf('::');
    return i < 0 ? key : key.slice(0, i);
}

function customPreviews() {
    const w = settings().welcome;
    if (!w.custom || typeof w.custom !== 'object') w.custom = {};
    return w.custom;
}

function allCardKeys() {
    return [...document.querySelectorAll('#chat .welcomePanel .recentChat')].map(cardKey);
}

async function editPreview(card) {
    const c = ctx();
    const key = cardKey(card);
    const store = customPreviews();
    const current = store[key];
    const name = card.querySelector('.characterName')?.textContent?.trim() || t`this chat`;
    const shown = card.querySelector('.chatMessage')?.textContent?.trim() ?? '';

    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = t`Preview for ${name}`;
    const hint = document.createElement('p');
    hint.className = 'mmu-popup-hint';
    hint.textContent = t`Shown on the start screen instead of the last message. The chat itself is not changed. Leave empty to show the last message again.`;
    content.append(title, hint);

    const RESET = 2;
    const popup = new c.Popup(content, c.POPUP_TYPE.INPUT, current ?? shown, {
        rows: 5,
        okButton: t`Save`,
        cancelButton: t`Cancel`,
        customButtons: current !== undefined ? [{ text: t`Use last message`, result: RESET, classes: ['mmu-popup-reset'] }] : null,
    });
    popup.dlg?.classList?.add('mmu-preview-popup');
    const value = await popup.show();

    if (popup.result === RESET) {
        delete store[key];
    } else if (typeof value === 'string') {
        const text = value.trim();
        if (text) store[key] = text;
        else delete store[key];
    } else {
        return; // cancelled
    }
    save();
    processCard(card);
    card.classList.remove('mmu-preview-saved');
    void card.offsetWidth;
    card.classList.add('mmu-preview-saved');
}

function ensureEditButton(card, enabled) {
    const actions = card.querySelector('.chatActions');
    const existing = actions?.querySelector('.mmu-editPreview');
    if (!enabled) { existing?.remove(); return; }
    if (!actions || existing) return;
    const button = document.createElement('button');
    button.className = 'menu_button menu_button_icon mmu-editPreview';
    button.type = 'button';
    button.title = t`Edit preview text`;
    button.setAttribute('aria-label', t`Edit preview text`);
    button.innerHTML = '<i class="fa-solid fa-quote-left fa-fw"></i>';
    // Clicking the card opens the chat, so keep the click to ourselves.
    button.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); void editPreview(card); });
    actions.prepend(button);
}

/*
 * Renaming a chat changes its file name, which is part of the key. When a rename
 * or delete is started on a chat with custom text, remember it; after the start
 * screen re-renders, move the text to the renamed chat or drop it for a deleted one.
 */
let pendingChange = null;

function rememberChange(ev) {
    const target = ev.target instanceof Element ? ev.target : null;
    const button = target?.closest?.('#chat .welcomePanel .recentChat :is(.renameChat, .deleteChat)');
    if (!button) return;
    const card = button.closest('.recentChat');
    const key = cardKey(card);
    if (customPreviews()[key] === undefined) return;
    pendingChange = { key, owner: ownerOf(key), before: new Set(allCardKeys()), deleting: button.classList.contains('deleteChat'), at: Date.now() };
}

function settlePendingChange() {
    if (!pendingChange) return;
    if (Date.now() - pendingChange.at > 5 * 60 * 1000) { pendingChange = null; return; }
    const keys = allCardKeys();
    if (!keys.length || keys.includes(pendingChange.key)) return; // not re-rendered yet, or cancelled
    const store = customPreviews();
    const added = keys.filter(k => !pendingChange.before.has(k) && ownerOf(k) === pendingChange.owner);
    if (!pendingChange.deleting && added.length === 1) store[added[0]] = store[pendingChange.key];
    delete store[pendingChange.key];
    pendingChange = null;
    save();
}

export function customPreviewCount() {
    return Object.keys(customPreviews()).length;
}

export function clearCustomPreviews() {
    settings().welcome.custom = {};
    save();
    processAll();
}

function processCard(card) {
    const el = card.querySelector('.chatMessage');
    if (!el) return;
    if (el.dataset.mmuRaw === undefined) el.dataset.mmuRaw = el.getAttribute('title') ?? el.textContent.trim();
    const raw = el.dataset.mmuRaw;
    const w = settings().welcome;
    const enabled = !!settings().enabled;
    const custom = enabled ? customPreviews()[cardKey(card)] : undefined;
    const next = custom !== undefined ? custom
        : !enabled || w.previewMode === 'raw' ? raw
            : cleanPreview(raw, card.getAttribute('data-avatar') || '');
    if (el.textContent !== next) el.textContent = next;
    el.setAttribute('title', next);
    el.classList.toggle('mmu-custom-preview', custom !== undefined);
    ensureEditButton(card, enabled);
}

export function processAll(root = document) {
    settlePendingChange();
    root.querySelectorAll?.('#chat .welcomePanel .recentChat').forEach(processCard);
}

export function apply() {
    const s = settings();
    const w = s.welcome;
    const body = document.body;
    const on = !!s.enabled;
    body.classList.toggle('mmu-hide-assistant', on && w.hideAssistant);
    body.classList.toggle('mmu-hide-welcome-prompt', on && w.hideShortcuts);
    body.classList.toggle('mmu-hide-preview', on && w.previewMode === 'hidden');
    body.style.setProperty('--mmu-preview-lines', String(Math.max(1, Math.min(8, Number(w.previewLines) || 2))));
    body.classList.toggle('mmu-preview-lines', on);
    processAll();
}

export async function mount() {
    const chat = document.getElementById('chat');
    if (chat && !observer) {
        observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.matches('.welcomePanel, .recentChat') || node.querySelector?.('.recentChat')) { processAll(); return; }
                }
            }
        });
        observer.observe(chat, { childList: true, subtree: true });
    }
    document.addEventListener('mmu:theme-applied', () => apply());
    document.addEventListener('click', rememberChange, true);
    apply();
    await loadRegex();
    processAll();
}
