/**
 * Bridge to SillyTavern. Everything comes from `SillyTavern.getContext()`,
 * so this extension has no fragile relative imports into the core.
 */
export const MODULE_NAME = 'modernMobileUI';

/** @returns {ReturnType<typeof SillyTavern.getContext>} */
export function ctx() {
    return SillyTavern.getContext();
}

export function events() {
    const c = ctx();
    return { source: c.eventSource, types: c.eventTypes ?? c.event_types };
}

export function t(strings, ...values) {
    try { return ctx().t(strings, ...values); } catch { return String.raw({ raw: strings }, ...values); }
}

export function isMobileLayout() {
    try { if (ctx().isMobile()) return true; } catch { /* ignore */ }
    return window.matchMedia('(max-width: 1000px)').matches;
}

export function toast() {
    return globalThis.toastr;
}

/** Last message written by a character (not the user, not system). */
export function lastCharacterMessage() {
    const chat = ctx().chat ?? [];
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m && !m.is_user && !m.is_system && typeof m.mes === 'string' && m.mes.trim()) {
            return { name: m.name, text: m.mes };
        }
    }
    return null;
}

/** Last message written by the user. */
export function lastUserMessage() {
    const chat = ctx().chat ?? [];
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m && m.is_user && typeof m.mes === 'string' && m.mes.trim()) return { name: m.name, text: m.mes };
    }
    return null;
}

export function currentCharacter() {
    const c = ctx();
    if (c.groupId) {
        const g = c.groups?.find(x => x.id === c.groupId);
        return g ? { name: g.name, description: '', isGroup: true } : null;
    }
    const ch = c.characters?.[c.characterId];
    return ch ? { name: ch.name, description: ch.description ?? '', personality: ch.personality ?? '', scenario: ch.scenario ?? '', isGroup: false } : null;
}

export function personaDescription() {
    try { return String(ctx().powerUserSettings?.persona_description ?? ''); } catch { return ''; }
}
