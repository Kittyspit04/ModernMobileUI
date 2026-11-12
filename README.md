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
- **Appearance modes**: Zinc (dark grey), Midnight (pure black for OLED screens), Light and Liquid Glass.
- **Liquid Glass**: a fourth appearance mode that keeps your SillyTavern background visible and turns the chat
  bubbles, composer, top bar, menus and panels into frosted glass with light rims. Because each surface blurs
  what is behind it, the glass shifts colour as you scroll over the background. The extension also samples
  the background and tints the glass and its rims with its colours, and it raises the minimum opacity on very
  bright backgrounds so text stays readable. Sliders for **glass opacity** (5 to 90 %) and **blur**, plus a
  switch for the background tint. Pick the background in SillyTavern's Backgrounds panel; chat backgrounds
  work too. The newest message gets a short light sweep when it arrives. Glass keeps its blur even with
  SillyTavern's "No Blur Effect" (Fast UI) option on; set the blur slider to 0 if scrolling feels slow.
- **Themes per chat**: every chat and every character (or group) can have its own appearance, chat layout and
  Liquid Glass opacity. The default appearance is used for the main UI (start screen) and for every chat
  without its own theme. Order: this chat, then this character, then the default. Choose it with **Chat
  theme** in the wand menu next to the input box, with the button in the settings, or with `/chat-theme`
  (`/chat-theme glass`, `/chat-theme scope=character midnight`, `/chat-theme default`). A chat's theme is
  saved inside the chat file, so it survives renames, backups and other devices; character themes are saved
  in the extension settings. Switching between chats with different themes cross-fades smoothly.
- **Backgrounds per chat**: the same picker has a **Background** grid with your backgrounds (and the ones
  uploaded to the open chat). Pick one for **This chat** or for **All chats with** the character or group;
  the first tile goes back to the global (or character) background. Order: this chat, then this character,
  then SillyTavern's global background. A chat background is SillyTavern's own chat lock, so the lock in the
  Backgrounds panel, `/lockbg` and `/unlockbg` stay in sync with it. Zinc, Midnight and Light cover the
  background, so picking one switches that chat (or character) to Liquid Glass; the glass tint follows each
  chat's background. Also `/chat-bg tavern`, `/chat-bg scope=character forest` (a file name or part of
  it) and `/chat-bg default`. New backgrounds are still uploaded in SillyTavern's Backgrounds panel; a pick
  there changes the global background, which a character background keeps covering in that
  character's chats.
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

### Start screen
- **Hide the assistant greeting** below the recent chats (on by default) so more of your recent chats fit on
  the screen. The shortcut buttons message can be hidden too.
- **Cleaner last-message previews** on the recent chat cards. The preview is the raw stored text of the
  chat's last message, so anything your Regex scripts only change *for display* never reached it. The
  extension now runs those display-only scripts on the previews (global, preset and the chat character's
  allowed scoped scripts), removes `[status]` header blocks such as time and location trackers, strips
  markup, and shows "No messages yet" instead of `[The message is empty]`.
- **Your own preview text per chat**: tap the quote button on a recent chat card and write what the card
  should show. Only the start screen changes; the chat file and its last message stay as they are. "Use last
  message" in the same dialog removes it again. The text follows the chat when you rename it there and is
  dropped when you delete the chat. Settings has a button to clear all custom previews.
- **Custom replacements**: one rule per line, `pattern => replacement`, with `/regex/flags` patterns
  supported; leave the right side empty to delete the match.
- **Preview lines** (1 to 8), or hide the preview entirely, or switch back to the unchanged text.
- How many chats are listed is SillyTavern's own setting: the gear button on the start screen.

### Slider lock
Range sliders in settings panels (temperature, penalties, and so on) are locked by default on the phone
layout. On desktop, where a mouse does not nudge them by accident, they stay free. Tapping or
dragging a locked slider does nothing and shows a short hint. The number box next to each slider stays
editable. A floating **Sliders locked** pill appears whenever a panel is open; tap it to unlock, and the lock
comes back when the panel closes. Both behaviours can be changed in the settings.

## Settings

All options live in **Extensions → Modern Mobile UI**. Changes apply live, no reload needed.

## Where things are stored

Everything is kept in `extension_settings.modernMobileUI` in your SillyTavern user settings, except what
belongs to one chat: a chat's theme is saved in the chat file's metadata (`modernMobileUI`), and a chat's
background in SillyTavern's own `custom_background` field there.

## Development notes

- `index.js` – bootstrap.
- `lib/theme.js` – turns settings into body classes, data attributes and CSS variables; per-character hues.
- `lib/enhance.js` – composer buttons, prompts, typing effect, undo, slash command.
- `lib/sliderlock.js` – the lock, the floating pill and the hint.
- `lib/layout.js` – auto-hiding bar, pull-tab, edge swipe, message navigation, tablet width, density.
- `lib/chattheme.js` – per-chat and per-character theme storage and resolution; `ui/chattheme.js` – the picker, wand item, `/chat-theme`.
- `lib/chatbg.js` – backgrounds per chat (SillyTavern's chat lock) and per character, `/chat-bg`.
- `lib/glass.js` – Liquid Glass: samples the background for tint, rim colour and readability floor.
- `lib/welcome.js` – start screen: hide greeting/shortcuts, preview clean-up with display regex and custom rules.
- `ui/settings.js` – the settings block in the Extensions panel.
- `style.css` – tokens, keyframes, base theme, colourful layout, motion layer, slider lock, settings styles.

## License

MIT
