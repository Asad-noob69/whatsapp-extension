# MediRec — Dashboard + WhatsApp Summarizer

Two things live here:

- **Project dashboard** (repo root: `index.html`, `app.js`, `data.json`) — a clean
  static site showing the project overview, milestones, achievements, and daily /
  weekly updates. Deploy it to Vercel or GitHub Pages.
- **WhatsApp summarizer extension** (`extension/`) — a Chrome extension that reads the
  MediRec.ca WhatsApp group, keeps history, summarizes it with Groq, and can push the
  summaries into this repo's `data.json` so the dashboard updates itself.

## Deploy the dashboard to Vercel
1. Import this repo at vercel.com (Framework preset: **Other**, no build command, output
   is the repo root). Deploy.
2. Your site is live at the Vercel URL. It reads `data.json`.

(For GitHub Pages instead: repo Settings → Pages → Deploy from branch `main` / root.)

## The extension
Load `extension/` as an unpacked extension (`chrome://extensions` → Developer mode →
Load unpacked). Then open its popup and set:
- **Groq API key** — get a free one at console.groq.com. (It is deliberately NOT stored
  in this repo. Paste it in the popup; it stays in your Chrome profile only.)
- **Group name** — `MediRec.ca`.
- To auto-update this dashboard: a **GitHub token** (repo scope), **repo**
  `Asad-noob69/whatsapp-extension`, **path** `data.json`, branch `main`, and tick
  **Auto publish daily and weekly**.

Full extension notes are in `extension/README.md`.

## Editing content by hand
`data.json` is plain JSON. Edit `project`, `milestones` (status `done` / `in_progress` /
`planned` / `blocked`), `achievements`, `daily`, `weekly` and commit. The bot only
overwrites `latestSummary`, `project.updatedAt`, and the current day / week entry.
