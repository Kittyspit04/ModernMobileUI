/**
 * Modern Mobile UI — a c.ai-style mobile theme for SillyTavern with smooth
 * animations, draft enhancement buttons, appearance modes and a slider lock.
 */
import { apply as applyTheme, watch as watchTheme, watchGeneration } from './lib/theme.js';
import { mountButtons, registerSlashCommands } from './lib/enhance.js';
import { mount as mountSliderLock } from './lib/sliderlock.js';
import { mount as mountSettings } from './ui/settings.js';
import { mount as mountLayout, apply as applyLayout } from './lib/layout.js';
import { mount as mountWelcome, apply as applyWelcome } from './lib/welcome.js';
import { mount as mountGlass } from './lib/glass.js';
import { mount as mountChatBackgrounds } from './lib/chatbg.js';
import { mount as mountSwipes } from './lib/swipes.js';
import { mountMenuItem as mountChatThemeItem, registerSlashCommand as registerChatThemeCommand } from './ui/chattheme.js';
import { events } from './lib/st.js';

function boot() {
    applyTheme();
    watchTheme();
    watchGeneration();
    mountButtons();
    mountSliderLock();
    mountLayout();
    mountWelcome();
    mountGlass();
    mountChatBackgrounds();
    mountSwipes();
    mountChatThemeItem();
    mountSettings();
    registerSlashCommands();
    registerChatThemeCommand();

    const { source, types } = events();
    source.on(types.APP_READY, () => { applyTheme(); mountButtons(); applyLayout(); applyWelcome(); });
    if (types.SETTINGS_UPDATED) source.on(types.SETTINGS_UPDATED, () => { applyTheme(); applyLayout(); });
    console.log('[ModernMobileUI] ready');
}

jQuery(() => {
    try { boot(); } catch (err) { console.error('[ModernMobileUI] failed to start', err); }
});
