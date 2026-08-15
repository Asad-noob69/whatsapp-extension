const $ = (id) => document.getElementById(id);
const DEFAULTS = { apiKey: "", model: "llama-3.3-70b-versatile", groupName: "MediRec.ca", intervalMinutes: 0, githubToken: "", githubRepo: "", githubPath: "data.json", githubBranch: "main", autoPublish: false };

function send(type, extra) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type, ...(extra || {}) }, resolve));
}

async function loadSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  $("apiKey").value = s.apiKey;
  $("model").value = s.model;
  $("groupName").value = s.groupName;
  $("interval").value = s.intervalMinutes;
  $("ghToken").value = s.githubToken;
  $("ghRepo").value = s.githubRepo;
  $("ghPath").value = s.githubPath;
  $("ghBranch").value = s.githubBranch;
  $("autoPublish").checked = !!s.autoPublish;
}

async function refresh() {
  const r = await send("getState");
  if (!r?.ok) { $("status").textContent = "Extension not ready."; return; }
  $("status").textContent =
    `${r.messageCount} messages saved · ${r.summaryCount} summaries` +
    (r.latestSummary ? ` · last ${new Date(r.latestSummary.at).toLocaleString()}` : "");
  $("summary").textContent = r.latestSummary ? r.latestSummary.text : "No summary yet.";
}

$("run").addEventListener("click", async () => {
  $("msg").textContent = "Summarizing…";
  const r = await send("summarizeNow");
  $("msg").textContent = r?.ok ? "Done." : "Error: " + (r?.error || "failed");
  refresh();
});

$("export").addEventListener("click", async () => {
  const r = await send("getExport");
  if (!r?.ok) { $("msg").textContent = "Export failed."; return; }
  const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `whatsapp-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  $("msg").textContent = "History exported.";
});

$("clear").addEventListener("click", async () => {
  if (!confirm("Delete all saved messages and summaries?")) return;
  await send("clear");
  $("msg").textContent = "Cleared.";
  refresh();
});

$("save").addEventListener("click", async () => {
  const settings = {
    apiKey: $("apiKey").value.trim(),
    model: $("model").value.trim() || DEFAULTS.model,
    groupName: $("groupName").value.trim() || DEFAULTS.groupName,
    intervalMinutes: Math.max(0, Number($("interval").value) || 0),
    githubToken: $("ghToken").value.trim(),
    githubRepo: $("ghRepo").value.trim(),
    githubPath: $("ghPath").value.trim() || "data.json",
    githubBranch: $("ghBranch").value.trim() || "main",
    autoPublish: $("autoPublish").checked,
  };
  await chrome.storage.local.set({ settings });
  $("saveMsg").textContent = "Saved.";
  setTimeout(() => ($("saveMsg").textContent = ""), 1500);
});

async function publish(kind) {
  $("msg").textContent = `Publishing ${kind}…`;
  const r = await send("publishNow", { kind });
  $("msg").textContent = r?.ok ? `Published ${kind} to the website.` : "Error: " + (r?.error || "failed");
  refresh();
}
$("pubDaily").addEventListener("click", () => publish("daily"));
$("pubWeekly").addEventListener("click", () => publish("weekly"));

loadSettings();
refresh();
