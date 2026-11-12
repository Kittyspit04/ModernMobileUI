/**
 * "Chat theme" picker: choose the appearance, chat layout, glass opacity and
 * background for the open chat or for every chat with this character/group.
 * Changes apply instantly with a cross-fade.
 */
import { ctx, t, toast } from '../lib/st.js';
import { settings } from '../lib/settings.js';
import {
    MODES, LAYOUTS, modeLabel, layoutLabel, chatOpen, owner, chatTheme, characterTheme,
    setChatTheme, setCharacterTheme, inherited, resolve, applyCommand,
} from '../lib/chattheme.js';
import { applyWithTransition } from '../lib/theme.js';
import {
    chatBackground, characterBackground, inheritedBackground, backgroundSource, setChatBackground,
    setCharacterBackground, listBackgrounds, thumbForUrl, labelForUrl, globalBackground,
} from '../lib/chatbg.js';

function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' || k === 'checked') node[k] = v;
        else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
}

const SOURCE_TEXT = { default: 'default', character: 'character', chat: 'this chat' };

function swatch(mode) {
    return el('span', { class: `mmu-ct-swatch mmu-ct-swatch-${mode}`, 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
}

/**
 * Set the background for a scope. Zinc, Midnight and Light cover the background,
 * so a scope that uses one of them switches to Liquid Glass.
 */
function pickBackground(scope, url) {
    if (scope === 'chat') setChatBackground(url); else setCharacterBackground(url);
    const layer = scope === 'chat' ? chatTheme() : characterTheme();
    const mode = layer.mode ?? inherited(scope).mode;
    if (url && mode !== 'glass' && document.body.classList.contains('mmu-on')) {
        if (scope === 'chat') setChatTheme({ mode: 'glass' }); else setCharacterTheme({ mode: 'glass' });
        applyWithTransition();
        toast()?.info(scope === 'chat' ? t`Switched this chat to Liquid Glass so the background shows.` : t`Switched ${owner()?.name ?? t`this character`} to Liquid Glass so the background shows.`);
    }
}

/**
 * Background chooser. Built once per picker so its scroll position and filter
 * survive re-renders; update() refreshes the highlights for the active scope.
 */
function backgroundSection({ getScope, onPick }) {
    const grid = el('div', { class: 'mmu-bg-grid', role: 'listbox', 'data-mmu-free': '1' });
    const filter = el('input', { type: 'search', class: 'text_pole mmu-bg-filter', placeholder: t`Search backgrounds`, hidden: true });
    const note = el('small', { class: 'mmu-ct-hint mmu-bg-note' });
    const inheritThumb = el('span', { class: 'mmu-bg-img' });
    const inheritLabel = el('span', { class: 'mmu-bg-name' });
    const inheritTile = el('button', { type: 'button', class: 'mmu-bg-tile mmu-bg-inherit', onClick: () => onPick(null) },
        inheritThumb, el('i', { class: 'fa-solid fa-arrow-turn-up mmu-bg-inherit-icon' }), inheritLabel);
    let tiles = [];

    const update = () => {
        const scope = getScope();
        const own = scope === 'chat' ? chatBackground() : characterBackground();
        const base = inheritedBackground(scope);
        const thumb = thumbForUrl(base.url);
        inheritThumb.style.backgroundImage = thumb ? `url("${thumb}")` : '';
        inheritLabel.textContent = `${base.source === 'character' ? t`Character` : t`Global`} · ${labelForUrl(base.url)}`;
        inheritTile.classList.toggle('is-active', !own);
        inheritTile.setAttribute('aria-selected', String(!own));
        for (const tile of tiles) {
            const on = !!own && tile.dataset.url === own;
            tile.classList.toggle('is-active', on);
            tile.setAttribute('aria-selected', String(on));
        }
        // An own background that is not in the list (deleted file, set elsewhere): show it as a tile.
        if (own && tiles.length && !tiles.some(tile => tile.dataset.url === own)) {
            addTiles([{ label: labelForUrl(own), url: own, thumb: thumbForUrl(own) }], true);
            update();
        }
    };

    const tileFor = (item) => {
        const tile = el('button', { type: 'button', class: 'mmu-bg-tile', title: item.label, 'data-url': item.url, 'data-label': item.label.toLowerCase(), role: 'option', onClick: () => onPick(item.url) },
            el('span', { class: 'mmu-bg-img', style: item.thumb ? `background-image: url("${item.thumb.replace(/"/g, '%22')}")` : null }),
            item.chat ? el('span', { class: 'mmu-bg-badge', text: t`chat` }) : null,
            el('span', { class: 'mmu-bg-name', text: item.label }),
        );
        return tile;
    };

    const addTiles = (items, first = false) => {
        const made = items.map(tileFor);
        tiles = first ? [...made, ...tiles] : [...tiles, ...made];
        if (first) inheritTile.after(...made); else grid.append(...made);
    };

    filter.addEventListener('input', () => {
        const q = filter.value.trim().toLowerCase();
        for (const tile of tiles) tile.hidden = !!q && !tile.dataset.label.includes(q) && !tile.classList.contains('is-active');
    });

    grid.append(inheritTile);
    grid.append(...Array.from({ length: 5 }, () => el('span', { class: 'mmu-bg-tile mmu-bg-skeleton', 'aria-hidden': 'true' })));
    listBackgrounds().then((items) => {
        grid.querySelectorAll('.mmu-bg-skeleton').forEach(n => n.remove());
        addTiles(items);
        filter.hidden = items.length <= 9;
        if (!items.length) grid.append(el('small', { class: 'mmu-ct-hint mmu-bg-empty', text: t`No backgrounds yet. Add some in SillyTavern's Backgrounds panel.` }));
        grid.classList.add('is-fresh');
        setTimeout(() => grid.classList.remove('is-fresh'), 700);
        update();
    }).catch((err) => {
        console.warn('[ModernMobileUI] could not list backgrounds', err);
        grid.querySelectorAll('.mmu-bg-skeleton').forEach(n => n.remove());
        grid.append(el('small', { class: 'mmu-ct-hint mmu-bg-empty', text: t`Could not load your backgrounds.` }));
    });

    const section = el('div', { class: 'mmu-bg' }, note, filter, grid,
        el('small', { class: 'mmu-ct-hint', text: t`Upload new backgrounds in SillyTavern's Backgrounds panel. "This chat" is SillyTavern's own chat background lock, so the lock there and /lockbg are the same setting.` }));
    return { section, grid, note, update };
}

export async function openPicker() {
    if (!settings().perChatThemes) {
        toast()?.info(t`Per-chat themes are switched off in Modern Mobile UI's settings.`);
        return;
    }
    if (!chatOpen()) {
        toast()?.info(t`Open a chat first. The start screen always uses the default appearance.`);
        return;
    }
    const o = owner();
    let scope = 'chat';
    const root = el('div', { class: 'mmu-ct' });
    const bg = backgroundSection({
        getScope: () => scope,
        onPick: (url) => {
            pickBackground(scope, url);
            render();
        },
    });

    const render = () => {
        const layer = scope === 'chat' ? chatTheme() : characterTheme();
        const base = inherited(scope);
        const set = (patch) => {
            if (scope === 'chat') setChatTheme(patch); else setCharacterTheme(patch);
            applyWithTransition();
            render();
        };
        const now = resolve();
        const effectiveMode = layer.mode ?? base.mode;

        const scopeRow = el('div', { class: 'mmu-ct-scope', role: 'tablist' },
            el('button', { type: 'button', class: scope === 'chat' ? 'is-active' : '', onClick: () => { scope = 'chat'; render(); } }, el('i', { class: 'fa-solid fa-comment' }), t`This chat`),
            o ? el('button', { type: 'button', class: scope === 'character' ? 'is-active' : '', onClick: () => { scope = 'character'; render(); } }, el('i', { class: `fa-solid ${o.isGroup ? 'fa-users' : 'fa-user'}` }), o.isGroup ? t`All chats in this group` : t`All chats with ${o.name}`) : null,
        );

        const inheritName = scope === 'chat' && base.source.mode === 'character' ? t`Character` : t`Default`;
        const modes = el('div', { class: 'mmu-ct-grid' },
            el('button', { type: 'button', class: `mmu-ct-card ${layer.mode === undefined ? 'is-active' : ''}`, onClick: () => set({ mode: null }) },
                swatch(base.mode), el('span', { class: 'mmu-ct-card-label', text: inheritName }), el('small', { text: modeLabel(base.mode) })),
            ...MODES.map(m => el('button', { type: 'button', class: `mmu-ct-card ${layer.mode === m.value ? 'is-active' : ''}`, onClick: () => set({ mode: m.value }) },
                swatch(m.value), el('span', { class: 'mmu-ct-card-label', text: t`${m.label}` }), m.value === 'midnight' ? el('small', { text: 'OLED' }) : m.value === 'glass' ? el('small', { text: t`your background` }) : null)),
        );

        const layouts = el('div', { class: 'mmu-ct-chips' },
            el('button', { type: 'button', class: layer.chatLayout === undefined ? 'is-active' : '', onClick: () => set({ chatLayout: null }) }, `${inheritName} · ${layoutLabel(base.chatLayout)}`),
            ...LAYOUTS.map(l => el('button', { type: 'button', class: layer.chatLayout === l.value ? 'is-active' : '', onClick: () => set({ chatLayout: l.value }) }, t`${l.label}`)),
        );

        let glassBlock = null;
        if (effectiveMode === 'glass') {
            const own = layer.glassOpacity !== undefined;
            const value = own ? layer.glassOpacity : base.glassOpacity;
            const out = el('span', { class: 'mmu-ct-value', text: `${value}%` });
            const range = el('input', { type: 'range', min: 5, max: 90, step: 1, value: String(value), 'data-mmu-free': '1', disabled: !own });
            range.addEventListener('input', () => { out.textContent = `${range.value}%`; if (scope === 'chat') setChatTheme({ glassOpacity: Number(range.value) }); else setCharacterTheme({ glassOpacity: Number(range.value) }); applyWithTransition(); });
            const useDefault = el('input', { type: 'checkbox', checked: !own });
            useDefault.addEventListener('change', () => { set({ glassOpacity: useDefault.checked ? null : value }); });
            glassBlock = el('div', { class: 'mmu-ct-glass', 'data-mmu-free': '1' },
                el('div', { class: 'mmu-ct-label', text: t`Glass opacity` }),
                el('label', { class: 'checkbox_label mmu-ct-check' }, useDefault, el('span', { text: t`Use ${inheritName.toLowerCase()} (${base.glassOpacity}%)` })),
                el('div', { class: 'mmu-ct-range' }, range, out),
                el('small', { class: 'mmu-ct-hint', text: t`The glass tint follows the background.` }),
            );
        }

        const bgSource = backgroundSource();
        const bgNow = chatBackground() || (bgSource === 'character' ? characterBackground() : globalBackground());
        const status = el('div', { class: 'mmu-ct-status' },
            el('i', { class: 'fa-solid fa-eye' }),
            el('span', {},
                `${t`Showing`}: ${modeLabel(now.mode)} (${t`${SOURCE_TEXT[now.source.mode]}`}) · ${layoutLabel(now.chatLayout)} (${t`${SOURCE_TEXT[now.source.chatLayout]}`})`,
                el('br'),
                `${t`Background`}: ${labelForUrl(bgNow)} (${bgSource === 'default' ? t`global` : t`${SOURCE_TEXT[bgSource]}`})`,
            ),
        );

        bg.update();
        const bgCovered = document.body.classList.contains('mmu-on') && effectiveMode !== 'glass';
        bg.note.textContent = bgCovered
            ? t`${modeLabel(effectiveMode)} covers the background. Picking one switches ${scope === 'chat' ? t`this chat` : t`these chats`} to Liquid Glass.`
            : '';
        bg.note.hidden = !bgCovered;
        const gridScroll = bg.grid.scrollTop;

        root.replaceChildren(...[
            el('h3', { text: t`Chat theme` }),
            el('div', { class: 'mmu-ct-sub', text: `${o?.name ?? ''}${ctx().getCurrentChatId?.() ? ` · ${ctx().getCurrentChatId()}` : ''}` }),
            scopeRow,
            el('div', { class: 'mmu-ct-label', text: t`Appearance` }), modes,
            el('div', { class: 'mmu-ct-label', text: t`Chat layout` }), layouts,
            glassBlock,
            el('div', { class: 'mmu-ct-label', text: t`Background` }), bg.section,
            status,
            el('small', { class: 'mmu-ct-hint', text: t`The main UI and chats without their own theme use the default appearance from Extensions → Modern Mobile UI.` }),
        ].filter(Boolean));
        bg.grid.scrollTop = gridScroll;
    };

    root.classList.add('is-opening');
    render();
    setTimeout(() => root.classList.remove('is-opening'), 700);
    const c = ctx();
    const popup = new c.Popup(root, c.POPUP_TYPE.TEXT, '', { okButton: t`Done`, wide: false, allowVerticalScrolling: true });
    popup.dlg?.classList?.add('mmu-ct-popup');
    await popup.show();
}

/** Add "Chat theme" to SillyTavern's wand menu once it exists. */
export function mountMenuItem() {
    const add = () => {
        const menu = document.getElementById('extensionsMenu');
        if (!menu || document.getElementById('mmu_chat_theme_wand')) return !!menu;
        const item = el('div', { id: 'mmu_chat_theme_wand', class: 'list-group-item flex-container flexGap5 interactable', tabindex: '0', title: t`Theme for this chat` },
            el('div', { class: 'fa-solid fa-palette extensionsMenuExtensionButton' }),
            el('span', { text: t`Chat theme` }),
        );
        item.addEventListener('click', () => { void openPicker(); });
        menu.append(item);
        return true;
    };
    if (add()) return;
    const observer = new MutationObserver(() => { if (add()) observer.disconnect(); });
    observer.observe(document.body, { childList: true });
}

export function registerSlashCommand() {
    const c = ctx();
    try {
        c.SlashCommandParser.addCommandObject(c.SlashCommand.fromProps({
            name: 'chat-theme',
            callback: async (args, value) => {
                const v = String(value ?? '').trim();
                if (!v) { await openPicker(); return ''; }
                const scope = String(args?.scope ?? 'chat').toLowerCase() === 'character' ? 'character' : 'chat';
                if (applyCommand(scope, v)) applyWithTransition();
                return '';
            },
            namedArgumentList: [c.SlashCommandNamedArgument?.fromProps?.({ name: 'scope', description: 'chat (default) or character', typeList: [c.ARGUMENT_TYPE.STRING], defaultValue: 'chat' })].filter(Boolean),
            unnamedArgumentList: [c.SlashCommandArgument.fromProps({ description: 'zinc | midnight | light | glass | default', typeList: [c.ARGUMENT_TYPE.STRING], isRequired: false })],
            helpString: 'Sets the Modern Mobile UI theme for the open chat. <code>/chat-theme glass</code>, <code>/chat-theme scope=character midnight</code>, <code>/chat-theme default</code> to inherit again. Without an argument it opens the theme picker.',
        }));
    } catch (err) {
        console.warn('[ModernMobileUI] /chat-theme registration failed', err);
    }
    try {
        c.SlashCommandParser.addCommandObject(c.SlashCommand.fromProps({
            name: 'chat-bg',
            callback: async (args, value) => {
                const v = String(value ?? '').trim();
                if (!v) { await openPicker(); return ''; }
                const scope = String(args?.scope ?? 'chat').toLowerCase() === 'character' ? 'character' : 'chat';
                if (scope === 'chat' ? !chatOpen() : !owner()) { toast()?.warning(t`Open a chat first.`); return ''; }
                let url = null;
                if (!['default', 'inherit', 'reset', 'global', 'none'].includes(v.toLowerCase())) {
                    const q = v.toLowerCase();
                    const items = await listBackgrounds().catch(() => []);
                    const hit = items.find(i => i.file.toLowerCase() === q || i.label.toLowerCase() === q)
                        ?? items.find(i => i.label.toLowerCase().includes(q));
                    if (!hit) { toast()?.warning(t`No background called "${v}".`); return ''; }
                    url = hit.url;
                }
                pickBackground(scope, url);
                return '';
            },
            namedArgumentList: [c.SlashCommandNamedArgument?.fromProps?.({ name: 'scope', description: 'chat (default) or character', typeList: [c.ARGUMENT_TYPE.STRING], defaultValue: 'chat' })].filter(Boolean),
            unnamedArgumentList: [c.SlashCommandArgument.fromProps({ description: 'background file name (or part of it), or default', typeList: [c.ARGUMENT_TYPE.STRING], isRequired: false })],
            helpString: 'Sets the background for the open chat (SillyTavern\'s chat lock) or, with <code>scope=character</code>, for every chat with this character. <code>/chat-bg tavern</code>, <code>/chat-bg scope=character forest</code>, <code>/chat-bg default</code> to use the global one again. Without an argument it opens the theme picker.',
        }));
    } catch (err) {
        console.warn('[ModernMobileUI] /chat-bg registration failed', err);
    }
}
