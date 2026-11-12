/**
 * Modern Mobile UI — a c.ai-style mobile theme for SillyTavern with smooth
 * animations, draft enhancement buttons, appearance modes and a slider lock.
 */
import { apply as applyTheme, watch as watchTheme, watchGeneration } from './lib/theme.js';
import { mountButtons, registerSlashCommands } from './lib/enhance.js';
import { mount as mountSliderLock } from './lib/sliderlock.js';
import { mount as mountSettings } from './ui/settings.js';
import { events } from './lib/st.js';

function boot() {
    applyTheme();
    watchTheme();
    watchGeneration();
    mountButtons();
    mountSliderLock();
    mountSettings();
    registerSlashCommands();

    const { source, types } = events();
    source.on(types.APP_READY, () => { applyTheme(); mountButtons(); });
    if (types.SETTINGS_UPDATED) source.on(types.SETTINGS_UPDATED, () => applyTheme());
    console.log('[ModernMobileUI] ready');
}

jQuery(() => {
    try { boot(); } catch (err) { console.error('[ModernMobileUI] failed to start', err); }
});
