/**
 * Draft enhancement: two buttons in the composer.
 *  - Polish: rewrite the draft on its own (grammar, flow, formatting).
 *  - Enhance with context: rewrite the draft so it answers the character's
 *    last message, using the character card and persona for continuity.
 * Both keep the original intent, never send anything, and offer Undo.
 */
import { ctx, t, toast, lastCharacterMessage, currentCharacter, personaDescription } from './st.js';
import { settings } from './settings.js';

let busy = false;
let undoStack = [];
let undoChip = null;
let undoTimer = null;

const textarea = () => /** @type {HTMLTextAreaElement|null} */ (document.getElementById('send_textarea'));

function setDraft(text, { animate = true } = {}) {
    const area = textarea();
    if (!area) return Promise.resolve();
    const commit = (value) => {
        area.value = value;
        area.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const s = settings();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || !s.enhance.typingEffect || !s.animations || reduced) {
        commit(text);
        return Promise.resolve();
    }
    // Typing effect: reveal in word chunks, capped at ~2 seconds.
    const words = text.split(/(\s+)/);
    const steps = Math.max(1, Math.ceil(words.length / 2));
    const delay = Math.min(28, 2000 / steps);
    return new Promise(resolve => {
        let i = 0;
        commit('');
        const tick = () => {
            i = Math.min(words.length, i + 2);
            commit(words.slice(0, i).join(''));
            if (i < words.length) setTimeout(tick, delay);
            else { area.focus(); area.setSelectionRange(area.value.length, area.value.length); resolve(); }
        };
        tick();
    });
}

function languageLine() {
    const lang = settings().enhance.language?.trim();
    return lang ? `Write the message in ${lang}.` : 'Keep the language of the draft.';
}

function buildPrompt(draft, { withContext }) {
    const c = ctx();
    const s = settings().enhance;
    const user = c.name1 || 'the user';
    const char = c.name2 || 'the character';
    const parts = [];

    if (s.includePersona) {
        const persona = personaDescription().trim();
        if (persona) parts.push(`About ${user} (the character the user plays):\n"""${persona.slice(0, 1200)}"""`);
    }
    if (withContext) {
        if (s.includeCharacter) {
            const ch = currentCharacter();
            if (ch?.description) parts.push(`About ${char} (the other character, for context only, never write for them):\n"""${String(ch.description).slice(0, 1200)}"""`);
        }
        const last = lastCharacterMessage();
        if (last) parts.push(`Last message from ${last.name || char}, which the user's message replies to:\n"""${last.text.slice(0, 2500)}"""`);
        else parts.push(`There is no previous message from ${char}; this opens the scene.`);
    }

    const task = withContext
        ? `Rewrite the draft below as a polished message from ${user} to ${char}. Make it a natural, in-character reply to ${char}'s last message: react to what they said or did, keep continuity with names, places and tone, and keep every intention of the draft. ${languageLine()}`
        : `Rewrite the draft below as a polished message from ${user} to ${char}. Improve wording, flow and formatting only; do not add new plot, do not change what ${user} does or says. ${languageLine()}`;

    parts.push(task);
    if (s.extraInstruction?.trim()) parts.push(`Additional instruction from the user: ${s.extraInstruction.trim()}`);
    parts.push(`Draft from ${user}:\n"""${draft}"""`);
    parts.push('Reply with the rewritten message only.');
    return parts.join('\n\n');
}

function clean(text) {
    let out = String(text ?? '').trim();
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    out = out.replace(/^(here( is|'s) (the|your|a) [^:\n]{0,60}:\s*)/i, '').trim();
    if (/^["“][\s\S]*["”]$/.test(out) && !out.slice(1, -1).includes('"')) out = out.slice(1, -1).trim();
    return out;
}

export async function enhance({ withContext }) {
    if (busy) return;
    const area = textarea();
    const draft = String(area?.value ?? '').trim();
    if (!draft) {
        toast()?.warning(t`Write a draft first, then tap enhance.`, t`Nothing to enhance`);
        area?.classList.add('mmu-shake');
        setTimeout(() => area?.classList.remove('mmu-shake'), 600);
        return;
    }
    const c = ctx();
    busy = true;
    document.body.classList.add('mmu-enhancing');
    setButtonsBusy(true);
    try {
        const s = settings().enhance;
        const result = clean(await c.generateRaw({
            prompt: buildPrompt(draft, { withContext }),
            systemPrompt: s.systemPrompt,
            responseLength: s.responseLength,
        }));
        if (!result) throw new Error(t`The model returned an empty answer.`);
        pushUndo(draft);
        await setDraft(result);
        showUndoChip();
    } catch (err) {
        console.error('[ModernMobileUI] enhance failed', err);
        toast()?.error(err?.message ?? String(err), t`Enhance failed`);
    } finally {
        busy = false;
        document.body.classList.remove('mmu-enhancing');
        setButtonsBusy(false);
    }
}

function pushUndo(text) {
    undoStack.push(text);
    while (undoStack.length > 5) undoStack.shift();
}

export function undo() {
    const previous = undoStack.pop();
    if (previous === undefined) return false;
    setDraft(previous, { animate: false });
    hideUndoChip();
    return true;
}

function showUndoChip() {
    hideUndoChip();
    const form = document.getElementById('send_form');
    if (!form) return;
    undoChip = document.createElement('button');
    undoChip.type = 'button';
    undoChip.id = 'mmu-undo-chip';
    undoChip.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span></span>';
    undoChip.querySelector('span').textContent = t`Undo enhancement`;
    undoChip.addEventListener('click', (ev) => { ev.preventDefault(); undo(); });
    form.prepend(undoChip);
    requestAnimationFrame(() => undoChip?.classList.add('is-open'));
    undoTimer = setTimeout(hideUndoChip, 20000);
}

function hideUndoChip() {
    clearTimeout(undoTimer);
    if (!undoChip) return;
    const chip = undoChip;
    undoChip = null;
    chip.classList.remove('is-open');
    setTimeout(() => chip.remove(), 250);
}

function setButtonsBusy(state) {
    for (const id of ['mmu_polish', 'mmu_enhance']) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('is-busy', state);
    }
}

function makeButton(id, icon, title, onClick) {
    const el = document.createElement('div');
    el.id = id;
    el.className = `mmu-enhance-btn fa-solid ${icon} interactable`;
    el.title = title;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', title);
    el.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); onClick(); });
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); } });
    return el;
}

export function mountButtons() {
    const right = document.getElementById('rightSendForm');
    const sendBut = document.getElementById('send_but');
    if (!right || !sendBut) return;
    if (!document.getElementById('mmu_polish')) {
        const polish = makeButton('mmu_polish', 'fa-pen-fancy', t`Polish draft (wording only)`, () => enhance({ withContext: false }));
        right.insertBefore(polish, sendBut);
    }
    if (!document.getElementById('mmu_enhance')) {
        const withCtx = makeButton('mmu_enhance', 'fa-wand-magic-sparkles', t`Enhance draft as a reply to the last message`, () => enhance({ withContext: true }));
        right.insertBefore(withCtx, sendBut);
    }
    // Ctrl/Cmd + Shift + E → context enhance; Ctrl/Cmd + Shift + P → polish
    textarea()?.addEventListener('keydown', (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'e') { ev.preventDefault(); enhance({ withContext: true }); }
        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'p') { ev.preventDefault(); enhance({ withContext: false }); }
        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'z') { if (undo()) ev.preventDefault(); }
    });
    updateVisibility();
}

export function updateVisibility() {
    const s = settings().enhance;
    document.getElementById('mmu_polish')?.classList.toggle('displayNone', !s.showPolish);
    document.getElementById('mmu_enhance')?.classList.toggle('displayNone', !s.showContext);
}

export function registerSlashCommands() {
    const c = ctx();
    try {
        c.SlashCommandParser.addCommandObject(c.SlashCommand.fromProps({
            name: 'enhance',
            aliases: ['mmu-enhance'],
            callback: async (_args, value) => {
                const mode = String(value ?? '').trim().toLowerCase();
                if (mode === 'undo') { undo(); return ''; }
                await enhance({ withContext: mode !== 'polish' });
                return '';
            },
            unnamedArgumentList: [c.SlashCommandArgument.fromProps({ description: 'context (default) | polish | undo', typeList: [c.ARGUMENT_TYPE.STRING], isRequired: false })],
            helpString: 'Rewrites the current draft in the input box with the connected model. <code>/enhance</code> replies to the character\'s last message, <code>/enhance polish</code> only improves wording, <code>/enhance undo</code> restores the previous draft.',
        }));
    } catch (err) {
        console.warn('[ModernMobileUI] slash command registration failed', err);
    }
}
