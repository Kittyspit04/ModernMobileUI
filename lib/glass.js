/**
 * Liquid Glass appearance: samples the current SillyTavern background and
 * derives CSS variables so the glass picks up its colours.
 *
 *  --mmu-glass-rgb    dark, slightly tinted base colour of the glass fill
 *  --mmu-glass-glow   light, vivid version of the background hue for rims and highlights
 *  --mmu-glass-floor  minimum fill opacity; rises on bright backgrounds so text stays readable
 *
 * The actual "see-through" effect comes from backdrop-filter in style.css;
 * these variables only tint it.
 */
import { settings } from './settings.js';
import { events } from './st.js';

const NEUTRAL = { base: [22, 24, 32], glow: [205, 225, 255], floor: 0 };
const cache = new Map();
let lastUrl = null;
let token = 0;

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const hue = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map(x => Math.round(x * 255));
}

/** URL of the background image SillyTavern is showing, or null. */
export function currentBackgroundUrl() {
    for (const id of ['bg_custom', 'bg1']) {
        const el = document.getElementById(id);
        if (!el) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || Number(style.opacity) === 0) continue;
        // SillyTavern sets the background inline and fades it with a CSS transition; during the
        // fade the computed value still shows the previous image, so prefer the inline value.
        const value = el.style.backgroundImage || style.backgroundImage;
        const match = value?.match(/url\(["']?(.*?)["']?\)/);
        if (match?.[1]) return match[1];
    }
    return null;
}

async function sample(url) {
    if (cache.has(url)) return cache.get(url);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c2d = canvas.getContext('2d', { willReadFrequently: true });
    c2d.drawImage(img, 0, 0, size, size);
    const data = c2d.getImageData(0, 0, size, size).data;

    let wr = 0, wg = 0, wb = 0, wsum = 0, lum = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max ? (max - min) / max : 0;
        const w = sat * sat + 0.02; // colourful pixels decide the hue, grey ones barely count
        wr += r * w; wg += g * w; wb += b * w; wsum += w;
        lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        n++;
    }
    const [h, s] = rgbToHsl(wr / wsum, wg / wsum, wb / wsum);
    const avgLum = lum / n;
    const result = {
        base: hslToRgb(h, Math.min(s, 0.6) * 0.55, 0.12),
        glow: hslToRgb(h, clamp(s * 1.1, 0.25, 0.85), 0.76),
        // Bright backgrounds: keep at least this much fill so light text stays readable.
        floor: Number(clamp((avgLum - 0.4) * 1.15, 0, 0.55).toFixed(2)),
    };
    cache.set(url, result);
    return result;
}

function write(tint) {
    const body = document.body.style;
    body.setProperty('--mmu-glass-rgb', tint.base.join(', '));
    body.setProperty('--mmu-glass-glow', tint.glow.join(', '));
    body.setProperty('--mmu-glass-floor', String(tint.floor));
}

/** Re-sample the background if Liquid Glass is active. */
export async function update(force = false) {
    const s = settings();
    const active = document.body.classList.contains('mmu-on') && s.mode === 'glass';
    if (!active) return;
    const tintOn = !!s.glass.tintFromBackground;
    const url = currentBackgroundUrl();
    const key = `${url}|${tintOn}`;
    if (!url) { lastUrl = null; write(NEUTRAL); return; }
    if (key === lastUrl && !force) return;
    lastUrl = key;
    const mine = ++token;
    try {
        const tint = await sample(url);
        // Without tinting the glass stays neutral, but the readability floor still follows the background.
        if (mine === token) write(tintOn ? tint : { ...NEUTRAL, floor: tint.floor });
    } catch {
        if (mine === token) write(NEUTRAL);
    }
}

export function mount() {
    // SillyTavern swaps backgrounds by changing the inline style of #bg1 (and #bg_custom on older versions).
    let settleTimer = null;
    const observer = new MutationObserver(() => {
        update();
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => update(), 1200); // again once the fade has finished
    });
    for (const id of ['bg1', 'bg_custom']) {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    const { source, types } = events();
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, () => setTimeout(() => update(), 300));
    document.addEventListener('mmu:theme-applied', () => update());
    update();
}
