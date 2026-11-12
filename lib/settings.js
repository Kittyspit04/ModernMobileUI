import { ctx, MODULE_NAME } from './st.js';

export const DEFAULT_ENHANCE_SYSTEM =
`You are an editor for a roleplay chat. You rewrite the user's draft into a polished message written by the user's character.
Rules: keep the meaning, intent, point of view and language of the draft. Fix spelling and grammar. Add a little vivid detail. Put actions in *asterisks* and spoken lines in quotation marks. Stay close to the original length, at most twice as long. Never write actions, thoughts or speech for the other character and never answer the draft yourself. Output only the rewritten message, with no preface, notes or quotation marks around the whole text.`;

export const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    desktopToo: false,
    mode: 'zinc',            // zinc | midnight | light | glass
    chatLayout: 'minimal',   // minimal | colorful
    perChatThemes: true,         // chats and characters may have their own theme
    /** @type {Record<string, {mode?: string, chatLayout?: string, glassOpacity?: number}>} key `char:${avatar}` or `group:${id}` */
    characterThemes: {},
    glass: {
        opacity: 35,             // % fill inside the glass bubbles
        blur: 16,                // px backdrop blur
        tintFromBackground: true,
    },
    accent: '#8b7cf6',
    perCharacterHue: true,
    font: 'onest',           // onest | system | default
    radius: 18,
    avatarSize: 34,
    nameBadge: 'c.ai',
    showNameBadge: true,
    overrideThemeColors: true,
    homeGreeting: 'Welcome back',
    animations: true,
    thinkingIndicator: true,   // bouncing dots + pulsing avatar while a reply is generated
    ignoreReducedMotion: false,
    animationIntensity: 'normal', // subtle | normal | lively
    wordReveal: true,
    enhance: {
        showPolish: true,
        showContext: true,
        layout: 'auto', // auto | both | single
        responseLength: 400,
        includePersona: true,
        includeCharacter: true,
        language: '',
        systemPrompt: DEFAULT_ENHANCE_SYSTEM,
        extraInstruction: '',
        typingEffect: true,
    },
    layout: {
        autoHideBar: true,
        autoHideDelay: 4000,
        revealScroll: true,
        revealPullTab: true,
        revealEdgeSwipe: true,
        pullTab: 'standard',      // standard | subtle
        jumpButtons: true,
        tabletMaxWidth: 800,
        density: 'full',          // full | side
    },
    welcome: {
        hideAssistant: true,      // the assistant greeting below the recent chats
        hideShortcuts: false,     // the system message with the shortcut buttons
        previewMode: 'clean',     // clean | raw | hidden
        applyRegex: true,         // run display-only Regex scripts on previews
        stripStatus: true,        // remove [status] header blocks
        previewLines: 3,
        emptyText: 'No messages yet',
        rules: '',                // "pattern => replacement" per line
        /** @type {Record<string, string>} custom preview text per chat, key `${avatar}::${file}` or `group:${id}::${file}` */
        custom: {},
    },
    sliders: {
        lockByDefault: true,
        relockOnClose: true,
        showPill: true,
    },
});

function deepMerge(target, source) {
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            deepMerge(target[key], value);
        } else if (target[key] === undefined) {
            target[key] = value;
        }
    }
    return target;
}

export function settings() {
    const all = ctx().extensionSettings;
    if (!all[MODULE_NAME] || typeof all[MODULE_NAME] !== 'object') all[MODULE_NAME] = {};
    return deepMerge(all[MODULE_NAME], structuredClone(DEFAULT_SETTINGS));
}

export function save() {
    ctx().saveSettingsDebounced();
}

export function set(path, value) {
    const s = settings();
    const parts = path.split('.');
    let obj = s;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
        obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    save();
    return s;
}

export function get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), settings());
}

export function resetAll() {
    const all = ctx().extensionSettings;
    all[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
    save();
    return all[MODULE_NAME];
}
