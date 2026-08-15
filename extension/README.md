# MediRec WhatsApp Summarizer (Chrome extension)

Reads your WhatsApp group **MediRec.ca** in the browser, keeps the conversation
history on this machine, and summarizes it with **Groq** AI. Everything stays in
your Chrome profile (chrome.storage.local); nothing is sent anywhere except to
Groq when you summarize.

## What it does
- Watches the open chat in WhatsApp Web. When it is your target group, it saves
  new messages (sender, time, text) into local storage, building a history.
- Summarizes the recent conversation on demand, or automatically on a timer.
- Shows a small floating "AI" panel inside the WhatsApp window, and a popup with
  history, export, and settings.

## One-time setup
1. Get a free Groq API key at https://console.groq.com (Create API Key). It looks like `gsk_...`.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder: `/home/user2/whatsapp-summarizer`.
5. Click the extension icon (puzzle piece → MediRec WhatsApp Summarizer → pin it),
   open its popup, paste your **Groq API key**, check the **Group name** is exactly
   `MediRec.ca` (must match the chat title in WhatsApp exactly), and press **Save settings**.

## Using it
- Launch WhatsApp the usual way (the app window you made with `install-whatsapp.sh`).
  It runs in the same Chrome profile, so the extension is active there too.
  **If WhatsApp was already open when you loaded the extension, reload it** (Ctrl+R,
  or close and reopen the app window).
- Open the **MediRec.ca** chat and scroll through the part you want captured (it can
  only read what WhatsApp has loaded on screen; scroll up to pull in older messages).
- Click the green **AI** button (bottom-right of the WhatsApp window) → **Summarize now**.
  Or open the extension popup from a normal Chrome window and press **Summarize now**.
- To auto-summarize, set "Auto-summarize every N minutes" in the popup (0 = off).

## Where the data lives
- Messages and summaries are stored locally in this Chrome profile
  (`chrome.storage.local`, `unlimitedStorage`). Use **Export** in the popup to save a
  JSON backup any time, or **Clear saved data** to wipe it.
- To put history in a real database instead, have the background worker POST to your
  own endpoint in `summarizeNow()`/`storeMessages()` — say the word and I'll wire it up.

## Notes and limits
- Reading is done by matching WhatsApp Web's page structure. If WhatsApp changes its
  layout, the selectors in `content.js` (`div.copyable-text`, `data-pre-plain-text`,
  `#main header span[title]`) may need updating.
- The group name must match the chat title exactly, including the dot in `MediRec.ca`.
- The AI summary is only as complete as the messages that have been captured, which is
  whatever has scrolled into view while the chat was open.

## Files
- `manifest.json` — extension config (MV3)
- `content.js` / `content.css` — reads the chat + the in-page AI panel
- `background.js` — storage + Groq calls + auto-summarize alarm
- `popup.html` / `popup.js` — history view, export, and settings
