/**
 * Start screen (welcome page) options:
 *  - hide the assistant greeting and/or the shortcut message below the recent chats
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
import { settings } from './settings.js';
import { ctx } from './st.js';

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

function processCard(card) {
    const el = card.querySelector('.chatMessage');
    if (!el) return;
    if (el.dataset.mmuRaw === undefined) el.dataset.mmuRaw = el.getAttribute('title') ?? el.textContent.trim();
    const raw = el.dataset.mmuRaw;
    const w = settings().welcome;
    const enabled = settings().enabled;
    const next = !enabled || w.previewMode === 'raw' ? raw : cleanPreview(raw, card.getAttribute('data-avatar') || '');
    if (el.textContent !== next) el.textContent = next;
    el.setAttribute('title', next);
}

export function processAll(root = document) {
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
    apply();
    await loadRegex();
    processAll();
}
