/**
 * Settings block in the Extensions panel. Uses SillyTavern's own control
 * classes so it looks native, with a few of our own touches.
 */
import { settings, set, resetAll, DEFAULT_ENHANCE_SYSTEM, DEFAULT_REPLY_PROMPT } from '../lib/settings.js';
import { apply as applyTheme } from '../lib/theme.js';
import { updateVisibility as refreshEnhanceButtons } from '../lib/enhance.js';
import { refresh as refreshSliderLock, setUnlocked } from '../lib/sliderlock.js';
import { apply as applyLayout, ensureRevealTrigger, mobilyzeDetected } from '../lib/layout.js';
import { apply as applyWelcome, customPreviewCount, clearCustomPreviews } from '../lib/welcome.js';
import { characterThemeCount, clearCharacterThemes, chatOpen, resolve as resolveChatTheme, modeLabel } from '../lib/chattheme.js';
import { openPicker as openChatThemePicker } from './chattheme.js';
import { t } from '../lib/st.js';

function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'checked' || k === 'value' || k === 'selected') node[k] = v;
        else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
}

function onChange() {
    ensureRevealTrigger();
    applyTheme();
    applyLayout();
    applyWelcome();
    refreshEnhanceButtons();
    refreshSliderLock();
}

function checkbox(path, label, hint) {
    const input = el('input', { type: 'checkbox', checked: !!get(path), onChange: () => { set(path, input.checked); onChange(); } });
    return el('label', { class: 'checkbox_label mmu-opt', title: hint ?? '' }, input, el('span', { text: label }), hint ? el('small', { class: 'mmu-opt-hint', text: hint }) : null);
}

function selectRow(path, label, options) {
    const select = el('select', { class: 'text_pole mmu-select', onChange: () => { set(path, select.value); onChange(); } },
        ...options.map(o => el('option', { value: o.value, selected: String(get(path)) === String(o.value), text: o.label })));
    return el('div', { class: 'mmu-row' }, el('span', { class: 'mmu-row-label', text: label }), select);
}

function textRow(path, label, { placeholder = '', type = 'text', hint = '' } = {}) {
    const input = el('input', { type, class: 'text_pole mmu-text', value: String(get(path) ?? ''), placeholder, onChange: () => { set(path, type === 'number' ? Number(input.value) : input.value); onChange(); } });
    return el('div', { class: 'mmu-row' }, el('span', { class: 'mmu-row-label', text: label, title: hint }), input);
}

function rangeRow(path, label, { min, max, step = 1, unit = '' }) {
    const value = el('span', { class: 'mmu-range-value', text: `${get(path)}${unit}` });
    const input = el('input', { type: 'range', min, max, step, value: String(get(path)), 'data-mmu-free': '1', onInput: () => { value.textContent = `${input.value}${unit}`; set(path, Number(input.value)); onChange(); } });
    return el('div', { class: 'mmu-row mmu-row-range' }, el('span', { class: 'mmu-row-label', text: label }), el('div', { class: 'mmu-range-wrap', 'data-mmu-free': '1' }, input, value));
}

function colorRow(path, label) {
    const input = el('input', { type: 'color', class: 'mmu-color', value: String(get(path)), onInput: () => { set(path, input.value); onChange(); } });
    return el('div', { class: 'mmu-row' }, el('span', { class: 'mmu-row-label', text: label }), input);
}

function get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), settings());
}

function section(title, icon, ...children) {
    return el('div', { class: 'mmu-section' }, el('div', { class: 'mmu-section-title' }, el('i', { class: `fa-solid ${icon}` }), el('span', { text: title })), ...children);
}

export function mount() {
    const host = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
    if (!host || document.getElementById('mmu-settings')) return;

    const content = el('div', { class: 'inline-drawer-content mmu-settings-body' });
    const render = () => {
        content.replaceChildren(
            section(t`Theme`, 'fa-palette',
                checkbox('enabled', t`Enable Modern Mobile UI`),
                selectRow('desktop.mode', t`On computers`, [{ value: 'desktop', label: t`Desktop mode (made for wide screens)` }, { value: 'mobile', label: t`Same layout as on the phone` }, { value: 'off', label: t`Off (SillyTavern's own look)` }]),
                selectRow('mode', t`Default appearance`, [{ value: 'zinc', label: t`Zinc (dark grey)` }, { value: 'midnight', label: t`Midnight (pure black, OLED)` }, { value: 'light', label: t`Light` }, { value: 'glass', label: t`Liquid Glass (your background)` }]),
                el('div', { class: 'mmu-glass-options' },
                    rangeRow('glass.opacity', t`Glass opacity`, { min: 5, max: 90, unit: '%' }),
                    rangeRow('glass.blur', t`Glass blur`, { min: 0, max: 40, unit: 'px' }),
                    checkbox('glass.tintFromBackground', t`Tint the glass with the background's colours`),
                    el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`Pick the background in SillyTavern's Backgrounds panel (the picture icon); chat backgrounds work too. On very bright backgrounds the glass keeps a minimum opacity so text stays readable. Lower the blur if scrolling feels slow.` }),
                ),
                selectRow('chatLayout', t`Chat layout`, [{ value: 'minimal', label: t`Minimal (grey bubbles)` }, { value: 'colorful', label: t`Colorful (accent bubbles)` }]),
                colorRow('accent', t`Accent colour`),
                checkbox('perCharacterHue', t`Tint each character with its own hue`, t`Colorful layout only`),
                selectRow('font', t`Font`, [{ value: 'onest', label: 'Onest' }, { value: 'system', label: t`System font` }, { value: 'default', label: t`Keep SillyTavern's font` }]),
                rangeRow('radius', t`Bubble roundness`, { min: 4, max: 28, unit: 'px' }),
                rangeRow('avatarSize', t`Avatar size`, { min: 24, max: 56, unit: 'px' }),
                checkbox('showNameBadge', t`Show a small badge after character names`),
                textRow('nameBadge', t`Badge text`, { placeholder: 'c.ai' }),
                textRow('homeGreeting', t`Home screen greeting`, { placeholder: t`Welcome back` }),
                checkbox('overrideThemeColors', t`Recolour panels, popups and inputs too`, t`Turn off to keep your UI theme colour pickers in charge`),
            ),
            section(t`Desktop mode`, 'fa-display',
                selectRow('desktop.chatWidth', t`Chat column width`, [{ value: 'auto', label: t`Auto (fits the screen)` }, { value: '760', label: t`Narrow (760 px)` }, { value: '960', label: t`Comfortable (960 px)` }, { value: '1200', label: t`Wide (1200 px)` }, { value: '1440', label: t`Extra wide (1440 px)` }, { value: 'st', label: t`SillyTavern's Chat Width setting` }]),
                el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`On screens wider than 1000 px. The menus open as wide centred sheets and the character and AI settings panels use the space beside the chat. Auto keeps lines readable on 16:9, 16:10 and ultrawide screens.` }),
                checkbox('desktop.lockSliders', t`Lock sliders on desktop too`, t`The lock is meant for touch screens, where sliders get nudged while scrolling`),
            ),
            section(t`Themes per chat`, 'fa-palette',
                checkbox('perChatThemes', t`Let chats and characters have their own theme and background`, t`The default appearance above is used for the main UI and every chat without its own theme. Backgrounds show with Liquid Glass`),
                el('div', { class: 'mmu-ct-settings-status', id: 'mmu-ct-settings-status' }),
                el('div', { class: 'menu_button mmu-small-btn', text: t`Theme for the open chat…`, onClick: () => { void openChatThemePicker(); } }),
                el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`Also in the wand menu next to the input box ("Chat theme"), or type /chat-theme glass, /chat-theme scope=character midnight, /chat-theme default.` }),
                characterThemeCount() ? el('div', { class: 'menu_button mmu-small-btn', text: `${t`Clear character themes`} (${characterThemeCount()})`, onClick: () => { if (confirm(t`Remove the themes and backgrounds saved for characters and groups? Themes and backgrounds saved inside chats stay.`)) { clearCharacterThemes(); onChange(); render(); } } }) : null,
            ),
            section(t`Motion`, 'fa-wand-sparkles',
                checkbox('animations', t`Smooth animations`),
                checkbox('thinkingIndicator', t`Thinking indicator while a reply is generated`, t`Bouncing dots and a pulsing avatar. Works even with Smooth animations switched off`),
                checkbox('ignoreReducedMotion', t`Play animations even if the phone asks to reduce motion`, t`Android's Remove animations setting otherwise turns them off`),
                selectRow('animationIntensity', t`Intensity`, [{ value: 'subtle', label: t`Subtle` }, { value: 'normal', label: t`Normal` }, { value: 'lively', label: t`Lively` }]),
                checkbox('wordReveal', t`Word-by-word reveal while streaming`, t`Needs Streaming and “Stream Fade-In” in User Settings → Miscellaneous`),
            ),
            section(t`Reply for me & Polish`, 'fa-wand-magic-sparkles',
                checkbox('enhance.showReply', t`Show the Reply for me button`, t`Writes your persona's next message from the whole chat (character card, World Info, persona, history) into the input box, without sending it. Text already in the box is used as the idea for the reply`),
                selectRow('enhance.replySource', t`Prompt`, [{ value: 'clean', label: t`Clean: card, persona, lore and recent chat` }, { value: 'preset', label: t`Full SillyTavern prompt with my preset` }]),
                el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`Clean keeps your preset's prompts out, so trackers, time headers and Internal States meant for the character are not copied into your reply. Your preset's model settings still apply. "Full" sends everything your preset sends.` }),
                textRow('enhance.replyHistory', t`Recent messages to include (clean prompt)`, { type: 'number' }),
                selectRow('enhance.replyLength', t`Reply length`, [{ value: 'match', label: t`Like my recent messages` }, { value: 'short', label: t`Short` }, { value: 'long', label: t`Long and detailed` }]),
                checkbox('enhance.showPolish', t`Show the Polish button`, t`Rewrites your draft for wording only, nothing new is added`),
                selectRow('enhance.layout', t`Composer buttons`, [{ value: 'auto', label: t`One button on narrow phones, two otherwise` }, { value: 'both', label: t`Always two buttons` }, { value: 'single', label: t`Always one button with a menu` }]),
                checkbox('enhance.includePersona', t`Polish: give the model your persona description`),
                checkbox('enhance.typingEffect', t`Type the result into the box word by word`),
                textRow('enhance.maxTokens', t`Max response tokens (0 = SillyTavern's setting)`, { type: 'number' }),
                el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`Thinking models such as Gemini count their thinking against this limit, so keep it at 0 or generous.` }),
                textRow('enhance.language', t`Output language`, { placeholder: t`blank = the language of the chat` }),
                textRow('enhance.extraInstruction', t`Extra instruction (both buttons)`, { placeholder: t`e.g. always write in first person` }),
                el('div', { class: 'mmu-row mmu-row-col' },
                    el('span', { class: 'mmu-row-label', text: t`Reply for me instruction` }),
                    (() => { const ta = el('textarea', { class: 'text_pole mmu-textarea', rows: 6, onChange: () => { set('enhance.replyPrompt', ta.value.trim() || DEFAULT_REPLY_PROMPT); } }); ta.value = get('enhance.replyPrompt'); return ta; })(),
                    el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`{{user}} and {{char}} are filled in. The length, a no-trackers rule, your idea, language and extra instruction are added automatically.` }),
                    el('div', { class: 'menu_button mmu-small-btn', text: t`Reset instruction`, onClick: () => { set('enhance.replyPrompt', DEFAULT_REPLY_PROMPT); render(); } }),
                ),
                el('div', { class: 'mmu-row mmu-row-col' },
                    el('span', { class: 'mmu-row-label', text: t`Polish system prompt` }),
                    (() => { const ta = el('textarea', { class: 'text_pole mmu-textarea', rows: 5, onChange: () => { set('enhance.systemPrompt', ta.value || DEFAULT_ENHANCE_SYSTEM); } }); ta.value = get('enhance.systemPrompt'); return ta; })(),
                    el('div', { class: 'menu_button mmu-small-btn', text: t`Reset prompt`, onClick: () => { set('enhance.systemPrompt', DEFAULT_ENHANCE_SYSTEM); render(); } }),
                ),
                el('small', { class: 'mmu-opt-hint', text: t`Tap the Reply for me button again while it writes to stop it. Shortcuts in the input box: Ctrl/Cmd+Shift+E reply for me, Ctrl/Cmd+Shift+P polish, Ctrl/Cmd+Shift+Z undo. Slash commands: /reply-for-me [idea], /enhance (polish), /enhance undo.` }),
            ),
            section(t`Mobile layout`, 'fa-mobile-screen',
                mobilyzeDetected() ? el('div', { class: 'mmu-warn' }, el('i', { class: 'fa-solid fa-triangle-exclamation' }), el('span', { text: t`Mobilyze is active. Its features overlap with these, so the auto-hiding bar and navigation buttons stay off until you disable Mobilyze in Manage extensions.` })) : null,
                checkbox('layout.autoHideBar', t`Auto-hide the top menu bar while reading`, t`Slides away when you scroll down in the chat`),
                rangeRow('layout.autoHideDelay', t`Hide again after`, { min: 0, max: 10000, step: 500, unit: ' ms' }),
                checkbox('layout.revealScroll', t`Reveal: scroll up`),
                checkbox('layout.revealPullTab', t`Reveal: pull-tab at the top`),
                checkbox('layout.revealEdgeSwipe', t`Reveal: swipe down from the top edge`),
                selectRow('layout.pullTab', t`Pull-tab style`, [{ value: 'standard', label: t`Standard` }, { value: 'subtle', label: t`Subtle` }]),
                checkbox('layout.jumpButtons', t`Message navigation buttons`, t`Floating up/down buttons on the right edge step through messages`),
                textRow('layout.tabletMaxWidth', t`Max chat width on tablets (px, 0 = off)`, { type: 'number' }),
                selectRow('layout.density', t`Message layout`, [{ value: 'full', label: t`Full width (avatar beside name)` }, { value: 'side', label: t`Side avatar (bubble next to avatar)` }]),
            ),
            section(t`Swipes`, 'fa-arrows-left-right',
                checkbox('swipes.buttonsOnly', t`Swipe only with the arrow buttons`, t`Swiping across the screen no longer changes the reply, so it can't happen by accident. SillyTavern's own Gestures setting is left as it is`),
                checkbox('swipes.bar', t`Swipe bar under the name`, t`The arrows, the swipe counter and the "Thought for…" field sit in one row between the name and the message`),
                checkbox('swipes.bigButtons', t`Bigger swipe arrows`, t`Easier to hit on small screens. Without the swipe bar they move just below the message instead of covering its text`),
            ),
            section(t`Start screen`, 'fa-house',
                checkbox('welcome.hideAssistant', t`Hide the assistant greeting`, t`Leaves more room for your recent chats`),
                checkbox('welcome.hideShortcuts', t`Hide the shortcut buttons message`),
                selectRow('welcome.previewMode', t`Last-message preview`, [{ value: 'clean', label: t`Cleaned up` }, { value: 'raw', label: t`As saved (unchanged)` }, { value: 'hidden', label: t`Hidden` }]),
                checkbox('welcome.applyRegex', t`Apply my display Regex scripts to previews`, t`The same scripts that change how messages look in the chat`),
                checkbox('welcome.stripStatus', t`Remove [status] blocks such as time and location headers`),
                rangeRow('welcome.previewLines', t`Preview lines`, { min: 1, max: 8 }),
                textRow('welcome.emptyText', t`Text for empty chats`, { placeholder: t`No messages yet` }),
                el('div', { class: 'mmu-row mmu-row-col' },
                    el('span', { class: 'mmu-row-label', text: t`Custom replacements` }),
                    (() => { const ta = el('textarea', { class: 'text_pole mmu-textarea', rows: 3, placeholder: '/\\$\\$/ =>  \nOOC: =>', onChange: () => { set('welcome.rules', ta.value); onChange(); } }); ta.value = get('welcome.rules') ?? ''; return ta; })(),
                    el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`One rule per line: pattern => replacement. Use /regex/flags for patterns; leave the right side empty to delete.` }),
                ),
                el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`Your own text for one chat: tap the quote button on its card on the start screen. It replaces the preview without changing the chat.` }),
                customPreviewCount() ? el('div', { class: 'menu_button mmu-small-btn', text: `${t`Clear custom previews`} (${customPreviewCount()})`, onClick: () => { if (confirm(t`Remove all custom preview texts?`)) { clearCustomPreviews(); render(); } } }) : null,
                el('small', { class: 'mmu-opt-hint mmu-opt-hint-flush', text: t`How many recent chats are listed is set with the gear button on the start screen.` }),
            ),
            section(t`Slider lock`, 'fa-lock',
                checkbox('sliders.lockByDefault', t`Lock sliders in settings panels`, t`Prevents accidental changes while scrolling on a phone`),
                checkbox('sliders.relockOnClose', t`Lock again when the panel closes`),
                checkbox('sliders.showPill', t`Show the floating lock button while a panel is open`),
                el('div', { class: 'menu_button mmu-small-btn', text: t`Unlock sliders now`, onClick: () => setUnlocked(true) }),
            ),
            el('div', { class: 'mmu-footer' },
                el('div', { class: 'menu_button mmu-small-btn redWarningBG', text: t`Reset all to defaults`, onClick: () => { if (confirm(t`Reset Modern Mobile UI settings?`)) { resetAll(); onChange(); render(); } } }),
                el('a', { href: 'https://github.com/Kittyspit04/ModernMobileUI', target: '_blank', rel: 'noopener', class: 'mmu-link', text: 'GitHub' }),
            ),
        );
    };
    render();

    const updateStatus = () => {
        const node = document.getElementById('mmu-ct-settings-status');
        if (!node) return;
        const theme = resolveChatTheme();
        node.textContent = !chatOpen()
            ? t`Now: main UI, ${modeLabel(theme.mode)} (default).`
            : theme.source.mode === 'default'
                ? t`Now: this chat uses the default, ${modeLabel(theme.mode)}.`
                : t`Now: this chat uses ${modeLabel(theme.mode)}, set for the ${theme.source.mode === 'chat' ? t`chat` : t`character`}. Changing the default above won't change it.`;
    };
    document.addEventListener('mmu:theme-applied', updateStatus);

    const block = el('div', { id: 'mmu-settings', class: 'inline-drawer' },
        el('div', { class: 'inline-drawer-toggle inline-drawer-header' }, el('b', { text: 'Modern Mobile UI' }), el('div', { class: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' })),
        content,
    );
    host.append(block);
    updateStatus();
}
