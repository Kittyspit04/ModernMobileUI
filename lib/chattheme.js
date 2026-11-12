/**
 * Themes per chat and per character.
 *
 * Resolution order (each field separately): this chat > this character/group > default.
 *  - Default: the regular settings (also used for the main UI / start screen).
 *  - Character or group: extension settings, keyed by avatar file or group id.
 *  - Chat: the chat file's own metadata, so it survives renames, backups and other devices.
 *
 * A theme covers the appearance mode, the chat layout and the Liquid Glass opacity.
 */
import { ctx, events, t, toast } from './st.js';
import { settings, save } from './settings.js';

export const MODES = [
    { value: 'zinc', label: 'Zinc' },
    { value: 'midnight', label: 'Midnight' },
    { value: 'light', label: 'Light' },
    { value: 'glass', label: 'Liquid Glass' },
];
export const LAYOUTS = [
    { value: 'minimal', label: 'Minimal' },
    { value: 'colorful', label: 'Colorful' },
];
const FIELDS = ['mode', 'chatLayout', 'glassOpacity'];
const META_KEY = 'modernMobileUI';

export function modeLabel(value) {
    return MODES.find(m => m.value === value)?.label ?? value;
}

export function layoutLabel(value) {
    return LAYOUTS.find(l => l.value === value)?.label ?? value;
}

function valid(field, value) {
    if (value === undefined || value === null || value === '') return false;
    if (field === 'mode') return MODES.some(m => m.value === value);
    if (field === 'chatLayout') return LAYOUTS.some(l => l.value === value);
    if (field === 'glassOpacity') return Number.isFinite(Number(value)) && Number(value) >= 5 && Number(value) <= 90;
    return false;
}

function clean(theme) {
    const out = {};
    for (const f of FIELDS) if (valid(f, theme?.[f])) out[f] = f === 'glassOpacity' ? Number(theme[f]) : theme[f];
    return out;
}

/** Is a chat open (as opposed to the start screen)? */
export function chatOpen() {
    try { return !!ctx().getCurrentChatId(); } catch { return false; }
}

/** Key and display name of the open character or group. */
export function owner() {
    const c = ctx();
    if (c.groupId) {
        const group = c.groups?.find(g => g.id === c.groupId);
        return { key: `group:${c.groupId}`, name: group?.name ?? t`this group`, isGroup: true };
    }
    const character = c.characters?.[c.characterId];
    if (character?.avatar) return { key: `char:${character.avatar}`, name: character.name, isGroup: false };
    return null;
}

export function chatTheme() {
    if (!chatOpen()) return {};
    return clean(ctx().chatMetadata?.[META_KEY]?.theme);
}

export function characterTheme() {
    const o = owner();
    if (!o) return {};
    return clean(settings().characterThemes?.[o.key]);
}

function writeLayer(current, patch) {
    const next = { ...current };
    for (const [field, value] of Object.entries(patch)) {
        if (!FIELDS.includes(field)) continue;
        if (valid(field, value)) next[field] = field === 'glassOpacity' ? Number(value) : value;
        else delete next[field];
    }
    return next;
}

/** Set fields for the open chat. Pass undefined/null for a field to inherit again. */
export function setChatTheme(patch) {
    if (!chatOpen()) return false;
    const c = ctx();
    const meta = c.chatMetadata;
    if (!meta) return false;
    const next = writeLayer(chatTheme(), patch);
    if (!meta[META_KEY] || typeof meta[META_KEY] !== 'object') meta[META_KEY] = {};
    if (Object.keys(next).length) meta[META_KEY].theme = next;
    else delete meta[META_KEY].theme;
    if (!Object.keys(meta[META_KEY]).length) delete meta[META_KEY];
    c.saveMetadataDebounced();
    return true;
}

/** Set fields for the open character or group. */
export function setCharacterTheme(patch) {
    const o = owner();
    if (!o) return false;
    const s = settings();
    if (!s.characterThemes || typeof s.characterThemes !== 'object') s.characterThemes = {};
    const next = writeLayer(characterTheme(), patch);
    if (Object.keys(next).length) s.characterThemes[o.key] = next;
    else delete s.characterThemes[o.key];
    save();
    return true;
}

export function characterThemeCount() {
    return Object.keys(settings().characterThemes ?? {}).length;
}

export function clearCharacterThemes() {
    settings().characterThemes = {};
    save();
}

function defaults() {
    const s = settings();
    return { mode: s.mode, chatLayout: s.chatLayout, glassOpacity: Number(s.glass?.opacity ?? 35) };
}

/**
 * The theme to show right now, with where each field comes from.
 * @returns {{ mode: string, chatLayout: string, glassOpacity: number, source: Record<string, 'default'|'character'|'chat'> }}
 */
export function resolve() {
    const result = { ...defaults(), source: { mode: 'default', chatLayout: 'default', glassOpacity: 'default' } };
    if (!settings().perChatThemes || !chatOpen()) return result;
    for (const [layer, name] of [[characterTheme(), 'character'], [chatTheme(), 'chat']]) {
        for (const f of FIELDS) {
            if (layer[f] !== undefined) { result[f] = layer[f]; result.source[f] = name; }
        }
    }
    return result;
}

/** What a scope inherits when it sets nothing itself: the layers below it. */
export function inherited(scope) {
    const base = { ...defaults(), source: { mode: 'default', chatLayout: 'default', glassOpacity: 'default' } };
    if (scope === 'chat') {
        const ch = characterTheme();
        for (const f of FIELDS) if (ch[f] !== undefined) { base[f] = ch[f]; base.source[f] = 'character'; }
    }
    return base;
}

/** Apply a slash-command style request: scope chat|character, value mode name or "default". */
export function applyCommand(scope, value) {
    const v = String(value ?? '').trim().toLowerCase();
    const alias = { oled: 'midnight', black: 'midnight', dark: 'zinc', grey: 'zinc', gray: 'zinc', 'liquid-glass': 'glass', liquid: 'glass', default: null, inherit: null, reset: null };
    const mode = v in alias ? alias[v] : v;
    if (mode !== null && !MODES.some(m => m.value === mode)) {
        toast()?.warning(t`Unknown theme "${value}". Use zinc, midnight, light, glass or default.`);
        return false;
    }
    if (scope === 'character') {
        if (!owner()) { toast()?.warning(t`Open a chat first.`); return false; }
        return setCharacterTheme({ mode });
    }
    if (!chatOpen()) { toast()?.warning(t`Open a chat first.`); return false; }
    return setChatTheme({ mode });
}

export function onChatChanged(callback) {
    const { source, types } = events();
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, () => setTimeout(callback, 0));
}
