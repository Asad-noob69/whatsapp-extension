// Service worker: stores captured messages, calls Groq to summarize, and runs
// an optional auto-summarize alarm. All settings and data live in
// chrome.storage.local (on this machine, in this Chrome profile).

const DEFAULTS = {
  apiKey: "",
  model: "llama-3.3-70b-versatile",
  groupName: "MediRec.ca",
  intervalMinutes: 0,       // 0 = auto-summarize off
  maxMessages: 8000,        // cap the stored history
  summarizeCount: 400,      // how many recent messages to send to the AI
  // Optional: publish summaries to the dashboard website's data.json on GitHub.
  githubToken: "",
  githubRepo: "",           // "owner/repo"
  githubPath: "data.json",
  githubBranch: "main",
  autoPublish: false,       // auto daily + weekly publish when token + repo are set
};

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(settings || {}) };
}

const msgKey = (m) => `${m.time}|${m.sender}|${m.text}`;

async function storeMessages(incoming) {
  const s = await getSettings();
  const { messages = [] } = await chrome.storage.local.get("messages");
  const seen = new Set(messages.map(msgKey));
  let added = 0;
  for (const m of incoming) {
    const k = msgKey(m);
    if (m.text && !seen.has(k)) {
      seen.add(k);
      messages.push({ ...m, ts: Date.now() });
      added++;
    }
  }
  const trimmed = messages.slice(-s.maxMessages);
  await chrome.storage.local.set({ messages: trimmed });
  return { total: trimmed.length, added };
}

async function callGroq(convoText, s) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${s.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: s.model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You summarize a WhatsApp group chat for a busy team. Each line in the conversation is prefixed with [time] Sender: text. Write a short, clear summary with three headings: Key points, Decisions, and Action items or open questions. Attribute things to the person who said them by name (for example, 'Asad asked about X' or 'Hammad confirmed Y'), so a reader can see who said what. Use plain language and short bullet points. If a heading has nothing, write 'None'.",
        },
        { role: "user", content: `Summarize this WhatsApp conversation:\n\n${convoText}` },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Groq error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "(empty summary)";
}

async function summarizeNow() {
  const s = await getSettings();
  if (!s.apiKey) throw new Error("Set your Groq API key in the extension popup first.");
  const { messages = [] } = await chrome.storage.local.get("messages");
  if (messages.length === 0) {
    throw new Error(`No messages captured yet. Open the "${s.groupName}" chat in WhatsApp so it can read the conversation.`);
  }
  const recent = messages.slice(-s.summarizeCount);
  const convo = recent.map((m) => `[${m.time}] ${m.sender}: ${m.text}`).join("\n");
  const text = await callGroq(convo, s);
  const entry = { at: Date.now(), text, messageCount: recent.length };
  const { summaries = [] } = await chrome.storage.local.get("summaries");
  summaries.push(entry);
  await chrome.storage.local.set({ latestSummary: entry, summaries: summaries.slice(-100) });
  return entry;
}

// ---- Dashboard publishing via the GitHub contents API ----
function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decodeUtf8(b64) {
  const bin = atob((b64 || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function weekLabel(d) {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const mon = new Date(d); mon.setDate(d.getDate() - day);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (x) => x.toISOString().slice(0, 10);
  return `${f(mon)} to ${f(sun)}`;
}
async function ghGet(s) {
  const url = `https://api.github.com/repos/${s.githubRepo}/contents/${s.githubPath}?ref=${encodeURIComponent(s.githubBranch)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${s.githubToken}`, Accept: "application/vnd.github+json" } });
  if (res.status === 404) return { sha: null, data: null };
  if (!res.ok) throw new Error(`GitHub read ${res.status}`);
  const j = await res.json();
  let data = null;
  try { data = JSON.parse(b64decodeUtf8(j.content)); } catch { data = null; }
  return { sha: j.sha, data };
}
async function ghPut(s, obj, sha, message) {
  const url = `https://api.github.com/repos/${s.githubRepo}/contents/${s.githubPath}`;
  const body = { message, content: b64encodeUtf8(JSON.stringify(obj, null, 2)), branch: s.githubBranch };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${s.githubToken}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`GitHub write ${res.status} to ${s.githubRepo}@${s.githubBranch}/${s.githubPath}: ${t.slice(0, 150)}`); }
}
async function publishToSite(summaryEntry, kind) {
  const s = await getSettings();
  if (!s.githubToken || !s.githubRepo) throw new Error("Add your GitHub token and repo (owner/repo) in the popup first.");
  const { sha, data } = await ghGet(s);
  const site = data || { project: { name: "MediRec" }, milestones: [], achievements: [], daily: [], weekly: [], latestSummary: null };
  site.latestSummary = { at: summaryEntry.at, text: summaryEntry.text };
  site.project = site.project || {};
  site.project.updatedAt = new Date(summaryEntry.at).toISOString();
  const today = new Date(summaryEntry.at).toISOString().slice(0, 10);
  if (kind === "daily" || kind === "both") {
    site.daily = site.daily || [];
    const ex = site.daily.find((d) => d.date === today);
    if (ex) ex.summary = summaryEntry.text; else site.daily.push({ date: today, summary: summaryEntry.text, points: [] });
    site.daily = site.daily.slice(-60);
  }
  if (kind === "weekly" || kind === "both") {
    site.weekly = site.weekly || [];
    const label = weekLabel(new Date(summaryEntry.at));
    const ex = site.weekly.find((w) => w.week === label);
    if (ex) ex.summary = summaryEntry.text; else site.weekly.push({ week: label, summary: summaryEntry.text, points: [] });
    site.weekly = site.weekly.slice(-26);
  }
  await ghPut(s, site, sha, `dashboard: ${kind} update ${today}`);
  return true;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "storeMessages") {
        sendResponse({ ok: true, ...(await storeMessages(msg.messages || [])) });
      } else if (msg.type === "summarizeNow") {
        sendResponse({ ok: true, summary: await summarizeNow() });
      } else if (msg.type === "getState") {
        const { latestSummary = null, messages = [], summaries = [] } =
          await chrome.storage.local.get(["latestSummary", "messages", "summaries"]);
        sendResponse({ ok: true, latestSummary, messageCount: messages.length, summaryCount: summaries.length });
      } else if (msg.type === "getExport") {
        const data = await chrome.storage.local.get(["messages", "summaries"]);
        sendResponse({ ok: true, data });
      } else if (msg.type === "publishNow") {
        const entry = await summarizeNow();
        await publishToSite(entry, msg.kind || "daily");
        sendResponse({ ok: true, summary: entry });
      } else if (msg.type === "clear") {
        await chrome.storage.local.set({ messages: [], summaries: [], latestSummary: null });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "unknown message type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // keep the channel open for the async response
});

async function setupAlarms() {
  const s = await getSettings();
  await chrome.alarms.clear("autoSummarize");
  await chrome.alarms.clear("dailyPublish");
  await chrome.alarms.clear("weeklyPublish");
  if (s.intervalMinutes > 0) chrome.alarms.create("autoSummarize", { periodInMinutes: Number(s.intervalMinutes) });
  if (s.autoPublish && s.githubToken && s.githubRepo) {
    chrome.alarms.create("dailyPublish", { periodInMinutes: 1440 });   // every 24h
    chrome.alarms.create("weeklyPublish", { periodInMinutes: 10080 }); // every 7 days
  }
}
chrome.runtime.onInstalled.addListener(setupAlarms);
chrome.runtime.onStartup.addListener(setupAlarms);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) setupAlarms();
});
chrome.alarms.onAlarm.addListener(async (a) => {
  try {
    if (a.name === "autoSummarize") await summarizeNow();
    else if (a.name === "dailyPublish") await publishToSite(await summarizeNow(), "daily");
    else if (a.name === "weeklyPublish") await publishToSite(await summarizeNow(), "weekly");
  } catch (_e) { /* best-effort background job */ }
});
