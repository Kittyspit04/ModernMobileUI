# Modern Mobile UI

A c.ai-style mobile theme for [SillyTavern](https://github.com/SillyTavern/SillyTavern), packaged as an
extension so nothing has to be pasted into Custom CSS. It bundles the dark, rounded chat look with smooth
animations across the whole interface, two draft-enhancement buttons in the composer, three appearance
modes, a colourful chat layout, and a slider lock that stops settings sliders from being nudged while you
scroll on a phone.

Pairs well with [Modern Persona](https://github.com/Kittyspit04/ModernPersona), which uses the same design
language.

## Install

1. In SillyTavern open **Extensions** (the cubes icon) → **Install extension**.
2. Paste the repository URL:

   ```
   https://github.com/Kittyspit04/ModernMobileUI
   ```

3. Install and let the page reload. On a phone or tablet the theme is active immediately. On desktop widths
   it stays off until you tick **Also apply on desktop widths** in its settings.

Requires a recent SillyTavern release (1.13 or newer). The enhancement buttons use whatever API and model
you are connected to.

## Features

### Theme
- Dark zinc palette, rounded bubbles, round avatars, Onest font, hidden timestamps and IDs, grey italics for
  actions, plain text for dialogue.
- Composer as one rounded pill with a filled send button and a pulsing stop button.
- Top icon bar that fits the screen width, rounded drawers, panels, popup menus and toasts.
- Restyled home screen: greeting line, round shortcut buttons, recent-chat cards.
- Quick Reply buttons as chips, Mobilyze widgets recoloured to match.
- **Appearance modes**: Zinc (dark grey), Midnight (pure black for OLED screens) and Light.
- **Chat layouts**: Minimal (grey bubbles) or Colorful (your bubbles in an accent gradient, each character
  tinted with its own hue, coloured names and avatar rings). Accent colour is a picker.
- Adjustable bubble roundness, avatar size, name badge text, home greeting, font, and whether the
  theme also recolours panels and inputs.

### Animations
- New messages rise and fade in. A bubble with bouncing dots appears while the reply is pending; while the
  character writes, the avatar gets a sonar ring and a breathing dot trails the text.
- Word-by-word reveal of streamed text (turn on **Streaming** and **Stream Fade-In** in User Settings →
  Miscellaneous).
- Drawers drop in, the open top-bar icon pops, popup menus and toasts spring in, recent chats and the
  character list stagger in, buttons squash on press, the composer glows while a draft is being enhanced.
- Three intensities (Subtle, Normal, Lively), an on/off switch, and the system *reduce motion* preference is
  respected unless you tick the override.
- The **thinking indicator** (dots and pulsing avatar while a reply is generated) has its own switch and keeps
  working when *Smooth animations* is off.

### Draft enhancement
Two buttons next to the send button. Neither sends anything; they only rewrite what is in the input box.

- **Polish** (pen icon): fixes grammar and flow, formats actions in asterisks and speech in quotes, keeps your
  meaning and length. Does not look at the chat.
- **Enhance** (wand icon): rewrites the draft as a proper reply to the character's last message. The model
  sees that message, the character card and your persona description, keeps continuity with names, places
  and tone, and never writes for the other character.

The result is typed into the box word by word. An **Undo enhancement** chip appears above the composer for
twenty seconds and restores the previous draft. Keyboard: Ctrl/Cmd+Shift+E (enhance), Ctrl/Cmd+Shift+P
(polish), Ctrl/Cmd+Shift+Z (undo). Slash command: `/enhance`, `/enhance polish`, `/enhance undo`.

Options: hide either button, max response tokens, output language, an extra standing instruction, whether
to include persona and character card, and the system prompt.

### Mobile layout (replaces Mobilyze)
- **Auto-hiding top bar**: slides away when you scroll down in the chat so the whole screen is story. It
  comes back when you scroll up, tap or drag the pull-tab at the top, or swipe down from the top edge.
  Each trigger can be switched off individually, but one always stays on so the bar can never get stuck.
  Opening any drawer shows the bar and keeps it there. The hide-again delay is adjustable.
- **Message navigation buttons**: a small pill on the right edge steps to the previous or next message.
  Hidden on the home screen.
- **Tablet centering**: chat, bars and drawers share one maximum width (800 px by default) so lines stay
  readable on wide screens and panels never bleed off-screen.
- **Message layout**: *Full width* (default) puts the avatar beside the name and gives the bubble the whole
  screen width; *Side avatar* keeps the bubble in a column next to the avatar.

If Mobilyze is still installed, Modern Mobile UI keeps its own bar and navigation features off and shows a
notice in its settings. Disable Mobilyze in Manage extensions to use the built-in versions.

### Slider lock
Range sliders in settings panels (temperature, penalties, and so on) are locked by default. Tapping or
dragging a locked slider does nothing and shows a short hint. The number box next to each slider stays
editable. A floating **Sliders locked** pill appears whenever a panel is open; tap it to unlock, and the lock
comes back when the panel closes. Both behaviours can be changed in the settings.

## Settings

All options live in **Extensions → Modern Mobile UI**. Changes apply live, no reload needed.

## Where things are stored

Everything is kept in `extension_settings.modernMobileUI` in your SillyTavern user settings.

## Development notes

- `index.js` – bootstrap.
- `lib/theme.js` – turns settings into body classes, data attributes and CSS variables; per-character hues.
- `lib/enhance.js` – composer buttons, prompts, typing effect, undo, slash command.
- `lib/sliderlock.js` – the lock, the floating pill and the hint.
- `lib/layout.js` – auto-hiding bar, pull-tab, edge swipe, message navigation, tablet width, density.
- `ui/settings.js` – the settings block in the Extensions panel.
- `style.css` – tokens, keyframes, base theme, colourful layout, motion layer, slider lock, settings styles.

## License

MIT
