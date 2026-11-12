/**
 * Composer helpers, two buttons next to Send:
 *  - Reply for me: writes the persona's next message. SillyTavern builds the full prompt
 *    (character card, World Info, author's note, persona, chat history) and our instruction
 *    is added at the end as a quiet prompt, so the reply follows the state of the roleplay.
 *    Text already in the box is used as the idea for the reply.
 *  - Polish: rewrites the draft on its own (grammar, flow, formatting).
 * Neither sends anything; both offer Undo.
 */
import { ctx, events, t, toast, lastCharacterMessage, currentCharacter, personaDescription } from './st.js';
import { settings, DEFAULT_REPLY_PROMPT } from './settings.js';

let busy = null;           // null | 'reply' | 'polish'
let stopRequested = false;
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

function names() {
    const c = ctx();
    return { user: c.name1 || 'User', char: c.name2 || 'the character' };
}

/* ---------- Polish ---------- */

function polishPrompt(draft) {
    const s = settings().enhance;
    const { user, char } = names();
    const parts = [];
    if (s.includePersona) {
        const persona = personaDescription().trim();
        if (persona) parts.push(`About ${user} (the character the user plays):\n"""${persona.slice(0, 1200)}"""`);
    }
    const lang = s.language?.trim();
    parts.push(`Rewrite the draft below as a polished message from ${user} to ${char}. Improve wording, flow and formatting only; do not add new plot, do not change what ${user} does or says. ${lang ? `Write the message in ${lang}.` : 'Keep the language of the draft.'}`);
    if (s.extraInstruction?.trim()) parts.push(`Additional instruction from the user: ${s.extraInstruction.trim()}`);
    parts.push(`Draft from ${user}:\n"""${draft}"""`);
    parts.push('Reply with the rewritten message only.');
    return parts.join('\n\n');
}

/* ---------- Reply for me ---------- */

const LENGTH_LINES = {
    match: 'Make it about as long as {{user}}\'s recent messages.',
    short: 'Keep it short: one or two brief paragraphs.',
    long: 'Make it a full, detailed reply of three to five paragraphs.',
};

/** The quiet prompt: the user's (editable) instruction plus the per-request lines. */
export function replyInstruction(idea = '') {
    const s = settings().enhance;
    const lines = [String(s.replyPrompt || DEFAULT_REPLY_PROMPT).trim()];
    lines.push(LENGTH_LINES[s.replyLength] ?? LENGTH_LINES.match);
    if (idea) lines.push(`The player wants this in {{user}}'s message. Turn it into the reply in {{user}}'s voice, expand it naturally and keep every intention:\n"""${idea}"""`);
    const lang = s.language?.trim();
    lines.push(lang ? `Write it in ${lang}.` : 'Write it in the language of the roleplay.');
    if (s.extraInstruction?.trim()) lines.push(`Additional instruction: ${s.extraInstruction.trim()}`);
    lines.push('Output only {{user}}\'s message, without a name label, preface or notes.');
    return `[${lines.join('\n')}]`;
}

/** Fallback for SillyTavern versions without generateQuietPrompt: a self-contained prompt. */
function fallbackReplyPrompt(idea) {
    const { user, char } = names();
    const parts = [];
    const persona = personaDescription().trim();
    if (persona) parts.push(`About ${user} (the character the user plays):\n"""${persona.slice(0, 1500)}"""`);
    const ch = currentCharacter();
    if (ch?.description) parts.push(`About ${char} (never write for them):\n"""${String(ch.description).slice(0, 1500)}"""`);
    const recent = (ctx().chat ?? []).filter(m => m && !m.is_system && m.mes).slice(-8);
    if (recent.length) parts.push(`Recent messages:\n${recent.map(m => `${m.name}: ${String(m.mes).slice(0, 1500)}`).join('\n\n')}`);
    else {
        const last = lastCharacterMessage();
        if (last) parts.push(`Last message from ${last.name || char}:\n"""${last.text.slice(0, 2500)}"""`);
    }
    parts.push(replyInstruction(idea).replace(/\{\{user\}\}/gi, user).replace(/\{\{char\}\}/gi, char));
    return parts.join('\n\n');
}

function clean(text) {
    const { user, char } = names();
    const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let out = String(text ?? '').trim();
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    out = out.replace(/^(here( is|'s) (the|your|a|my) [^:\n]{0,60}:\s*)/i, '').trim();
    out = out.replace(new RegExp(`^(\\*\\*)?${esc(user)}(\\*\\*)?:\\s*`, 'i'), '').trim();
    // Stop where the model starts writing the character's turn.
    const charTurn = out.search(new RegExp(`\\n\\s*(\\*\\*)?${esc(char)}(\\*\\*)?:`, 'i'));
    if (charTurn > 0) out = out.slice(0, charTurn).trim();
    if (/^["“][\s\S]*["”]$/.test(out) && !out.slice(1, -1).includes('"')) out = out.slice(1, -1).trim();
    return out;
}

/* ---------- running an action ---------- */

function refuse(message, title) {
    toast()?.warning(message, title);
    const area = textarea();
    area?.classList.add('mmu-shake');
    setTimeout(() => area?.classList.remove('mmu-shake'), 600);
}

async function run(kind, produce) {
    if (busy) return;
    if (document.body.dataset.generating !== undefined) {
        refuse(t`Wait until the current reply is finished.`, t`Busy`);
        return;
    }
    const area = textarea();
    const before = String(area?.value ?? '');
    busy = kind;
    stopRequested = false;
    document.body.classList.add('mmu-enhancing');
    setButtonsBusy(kind);
    try {
        const result = clean(await produce(before.trim()));
        if (stopRequested) return;
        if (!result) throw new Error(t`The model returned an empty answer.`);
        pushUndo(before);
        await setDraft(result);
        showUndoChip(kind);
    } catch (err) {
        if (stopRequested) return;
        console.error(`[ModernMobileUI] ${kind} failed`, err);
        toast()?.error(err?.message ?? String(err), kind === 'reply' ? t`Reply for me failed` : t`Polish failed`);
    } finally {
        busy = null;
        document.body.classList.remove('mmu-enhancing');
        setButtonsBusy(null);
    }
}

/** Write the persona's next message from the whole chat; text in the box becomes the idea. */
export function replyForMe() {
    return run('reply', async (idea) => {
        const c = ctx();
        const s = settings().enhance;
        if (typeof c.generateQuietPrompt === 'function') {
            return c.generateQuietPrompt({
                quietPrompt: replyInstruction(idea),
                responseLength: Number(s.responseLength) || null,
                removeReasoning: true,
                trimToSentence: true,
            });
        }
        return c.generateRaw({ prompt: fallbackReplyPrompt(idea), responseLength: Number(s.responseLength) || null });
    });
}

/** Rewrite the draft for wording only. */
export function polish() {
    const draft = String(textarea()?.value ?? '').trim();
    if (!draft) {
        refuse(t`Write a draft first, then tap Polish.`, t`Nothing to polish`);
        return Promise.resolve();
    }
    return run('polish', async (text) => {
        const c = ctx();
        const s = settings().enhance;
        return c.generateRaw({ prompt: polishPrompt(text), systemPrompt: s.systemPrompt, responseLength: Number(s.responseLength) || null });
    });
}

/** Stop a running "Reply for me". */
export function stop() {
    if (busy !== 'reply') return false;
    stopRequested = true;
    try { ctx().stopGeneration?.(); } catch { /* ignore */ }
    toast()?.info(t`Stopped.`);
    return true;
}

/* ---------- undo ---------- */

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

function showUndoChip(kind) {
    hideUndoChip();
    const form = document.getElementById('send_form');
    if (!form) return;
    undoChip = document.createElement('button');
    undoChip.type = 'button';
    undoChip.id = 'mmu-undo-chip';
    undoChip.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span></span>';
    undoChip.querySelector('span').textContent = kind === 'reply' ? t`Undo reply` : t`Undo polish`;
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

/* ---------- buttons ---------- */

const REPLY_ICON = 'fa-wand-magic-sparkles';

function setButtonsBusy(kind) {
    const polishBtn = document.getElementById('mmu_polish');
    const replyBtn = document.getElementById('mmu_enhance');
    polishBtn?.classList.toggle('is-busy', kind === 'polish');
    // The reply button (or the single menu button) becomes a stop button while a reply is written.
    const replyActive = kind === 'reply' || (kind === 'polish' && replyBtn?.classList.contains('is-single'));
    replyBtn?.classList.toggle('is-busy', replyActive);
    replyBtn?.classList.toggle('can-stop', kind === 'reply');
    replyBtn?.classList.toggle(REPLY_ICON, kind !== 'reply');
    replyBtn?.classList.toggle('fa-circle-stop', kind === 'reply');
    if (replyBtn) replyBtn.title = kind === 'reply' ? t`Stop writing the reply` : replyTitle();
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

function replyTitle() {
    return singleMode() ? t`Reply for me, Polish…` : t`Reply for me: write my next message from the chat`;
}

export function mountButtons() {
    const right = document.getElementById('rightSendForm');
    const sendBut = document.getElementById('send_but');
    if (!right || !sendBut) return;
    if (!document.getElementById('mmu_polish')) {
        const polishBtn = makeButton('mmu_polish', 'fa-pen-fancy', t`Polish draft (wording only)`, () => { void polish(); });
        right.insertBefore(polishBtn, sendBut);
    }
    if (!document.getElementById('mmu_enhance')) {
        const replyBtn = makeButton('mmu_enhance', REPLY_ICON, replyTitle(), () => {
            if (busy === 'reply') { stop(); return; }
            if (singleMode()) openMenu(replyBtn); else void replyForMe();
        });
        right.insertBefore(replyBtn, sendBut);
    }
    // Ctrl/Cmd + Shift + E → reply for me; Ctrl/Cmd + Shift + P → polish; Ctrl/Cmd + Shift + Z → undo
    textarea()?.addEventListener('keydown', (ev) => {
        if (!(ev.ctrlKey || ev.metaKey) || !ev.shiftKey) return;
        const key = ev.key.toLowerCase();
        if (key === 'e') { ev.preventDefault(); void replyForMe(); }
        if (key === 'p') { ev.preventDefault(); void polish(); }
        if (key === 'z') { if (undo()) ev.preventDefault(); }
    });
    updateVisibility();
    window.addEventListener('resize', () => updateVisibility());
    // SillyTavern's own stop button ends a running reply too: don't report that as an error.
    if (!mountButtons.listening) {
        mountButtons.listening = true;
        document.addEventListener('mmu:theme-applied', () => updateVisibility());
        const { source, types } = events();
        if (types.GENERATION_STOPPED) source.on(types.GENERATION_STOPPED, () => { if (busy === 'reply') stopRequested = true; });
    }
}

function singleMode() {
    const layout = settings().enhance.layout ?? 'auto';
    if (layout === 'single') return true;
    if (layout === 'both') return false;
    return window.matchMedia('(max-width: 480px)').matches;
}

export function updateVisibility() {
    const s = settings().enhance;
    const single = singleMode();
    const polishBtn = document.getElementById('mmu_polish');
    const replyBtn = document.getElementById('mmu_enhance');
    polishBtn?.classList.toggle('displayNone', single || !s.showPolish);
    replyBtn?.classList.toggle('displayNone', single ? (!s.showReply && !s.showPolish) : !s.showReply);
    replyBtn?.classList.toggle('is-single', single);
    if (replyBtn && busy !== 'reply') replyBtn.title = replyTitle();
}

function closeMenu() {
    document.getElementById('mmu-enhance-menu')?.remove();
}

/** Popover with all actions, used when only one composer button is shown. */
function openMenu(anchor) {
    closeMenu();
    const s = settings().enhance;
    const menu = document.createElement('div');
    menu.id = 'mmu-enhance-menu';
    const item = (icon, label, hint, onClick, disabled = false) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.disabled = disabled;
        b.innerHTML = `<i class="fa-solid ${icon}"></i><span><span class="mmu-menu-label"></span><small></small></span>`;
        b.querySelector('.mmu-menu-label').textContent = label;
        b.querySelector('small').textContent = hint;
        b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); closeMenu(); onClick(); });
        menu.append(b);
    };
    const hasDraft = !!String(textarea()?.value ?? '').trim();
    if (s.showReply) item(REPLY_ICON, t`Reply for me`, hasDraft ? t`Your persona's next message, built on your idea` : t`Your persona's next message from the chat`, () => { void replyForMe(); });
    if (s.showPolish) item('fa-pen-fancy', t`Polish`, t`Wording only, no chat context`, () => { void polish(); }, !hasDraft);
    item('fa-rotate-left', t`Undo`, t`Restore the previous text`, () => undo(), undoStack.length === 0);
    menu.addEventListener('click', ev => ev.stopPropagation());
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth || 230;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))}px`;
    menu.style.top = `${Math.max(8, rect.top - menu.offsetHeight - 8)}px`;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    const off = (ev) => { if (!menu.contains(ev.target)) { closeMenu(); document.removeEventListener('pointerdown', off, true); } };
    setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
}

export function registerSlashCommands() {
    const c = ctx();
    try {
        c.SlashCommandParser.addCommandObject(c.SlashCommand.fromProps({
            name: 'reply-for-me',
            aliases: ['mmu-reply'],
            callback: async (_args, value) => {
                const idea = String(value ?? '').trim();
                if (idea) {
                    const area = textarea();
                    if (area) { area.value = idea; area.dispatchEvent(new Event('input', { bubbles: true })); }
                }
                await replyForMe();
                return '';
            },
            unnamedArgumentList: [c.SlashCommandArgument.fromProps({ description: 'optional idea for the reply', typeList: [c.ARGUMENT_TYPE.STRING], isRequired: false })],
            helpString: 'Writes your persona\'s next message into the input box from the whole chat, without sending it. <code>/reply-for-me</code>, or with an idea: <code>/reply-for-me she accepts but asks for gold</code>. Text already in the box is used as the idea too.',
        }));
        c.SlashCommandParser.addCommandObject(c.SlashCommand.fromProps({
            name: 'enhance',
            aliases: ['mmu-enhance'],
            callback: async (_args, value) => {
                const mode = String(value ?? '').trim().toLowerCase();
                if (mode === 'undo') { undo(); return ''; }
                if (mode === 'reply') { await replyForMe(); return ''; }
                await polish();
                return '';
            },
            unnamedArgumentList: [c.SlashCommandArgument.fromProps({ description: 'polish (default) | reply | undo', typeList: [c.ARGUMENT_TYPE.STRING], isRequired: false })],
            helpString: 'Works on the input box with the connected model. <code>/enhance</code> polishes the draft (wording only), <code>/enhance reply</code> writes your persona\'s next message like Reply for me, <code>/enhance undo</code> restores the previous text.',
        }));
    } catch (err) {
        console.warn('[ModernMobileUI] slash command registration failed', err);
    }
}
