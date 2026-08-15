// Runs inside web.whatsapp.com. Reads the currently-open chat when it is the
// target group, sends new messages to the background to store, and shows a small
// floating panel (useful in the standalone WhatsApp app window, which has no
// browser toolbar to reach the popup).

(function () {
  let groupName = "MediRec.ca";

  chrome.storage.local.get("settings").then(({ settings }) => {
    if (settings?.groupName) groupName = settings.groupName;
    const g = document.getElementById("wa-sum-group");
    if (g) g.textContent = groupName;
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === "local" && c.settings?.newValue?.groupName) {
      groupName = c.settings.newValue.groupName;
      const g = document.getElementById("wa-sum-group");
      if (g) g.textContent = groupName;
    }
  });

  const norm = (s) => (s || "").trim().toLowerCase();

  function currentChatTitle() {
    const main = document.querySelector("#main");
    if (!main) return "";
    for (const sel of ["header span[title]", "header [title]", 'header span[dir="auto"]']) {
      const el = main.querySelector(sel);
      const t = el ? (el.getAttribute("title") || el.textContent || "").trim() : "";
      if (t) return t;
    }
    return "";
  }

  // Each message bubble has a div.copyable-text with
  // data-pre-plain-text = "[HH:MM, M/D/YYYY] Sender Name: " and the text inside
  // a .selectable-text span.
  function scrapeMessages() {
    const out = [];
    document.querySelectorAll("#main div.copyable-text").forEach((el) => {
      const meta = el.getAttribute("data-pre-plain-text") || "";
      const textEl = el.querySelector(".selectable-text");
      const text = textEl ? textEl.innerText.trim() : "";
      if (!text) return;
      const m = meta.match(/^\[(.+?)\]\s([\s\S]+?):\s$/);
      out.push({ time: m ? m[1] : "", sender: m ? m[2] : "You", text });
    });
    return out;
  }

  let lastKey = "";
  function collect() {
    if (norm(currentChatTitle()) !== norm(groupName)) return;
    const msgs = scrapeMessages();
    if (msgs.length === 0) return;
    const key = msgs.length + "|" + (msgs[msgs.length - 1]?.text || "");
    if (key === lastKey) return;
    lastKey = key;
    chrome.runtime.sendMessage({ type: "storeMessages", messages: msgs }, () => updateStatus());
  }

  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const debounced = debounce(collect, 1500);
  new MutationObserver(debounced).observe(document.body, { childList: true, subtree: true });
  setInterval(collect, 10000); // safety net for missed mutations

  // ---- floating panel ----
  const btn = document.createElement("div");
  btn.id = "wa-sum-btn";
  btn.title = "MediRec Summarizer";
  btn.textContent = "AI";
  document.documentElement.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "wa-sum-panel";
  panel.innerHTML =
    '<div class="wa-sum-head"><span>MediRec Summarizer</span><span id="wa-sum-close">×</span></div>' +
    '<div class="wa-sum-status" id="wa-sum-status"></div>' +
    '<div class="wa-sum-body" id="wa-sum-body">No summary yet. Open the group chat, then press Summarize now.</div>' +
    '<div class="wa-sum-actions"><button id="wa-sum-run">Summarize now</button></div>' +
    '<div class="wa-sum-hint">Reads the "<span id="wa-sum-group">MediRec.ca</span>" chat while it is open.</div>';
  document.documentElement.appendChild(panel);

  btn.addEventListener("click", () => { panel.classList.toggle("open"); refresh(); });
  panel.querySelector("#wa-sum-close").addEventListener("click", () => panel.classList.remove("open"));
  panel.querySelector("#wa-sum-run").addEventListener("click", run);

  function updateStatus() {
    chrome.runtime.sendMessage({ type: "getState" }, (r) => {
      const s = document.getElementById("wa-sum-status");
      if (!s || !r?.ok) return;
      const title = currentChatTitle();
      const match = norm(title) === norm(groupName);
      s.textContent =
        `Open chat: ${title || "(none)"}${match ? " ✓ reading" : ` — open "${groupName}" to read`}` +
        ` · ${r.messageCount || 0} saved`;
    });
  }
  function refresh() {
    updateStatus();
    chrome.runtime.sendMessage({ type: "getState" }, (r) => {
      if (r?.ok && r.latestSummary) document.getElementById("wa-sum-body").textContent = r.latestSummary.text;
    });
  }
  function run() {
    const body = document.getElementById("wa-sum-body");
    body.textContent = "Summarizing…";
    chrome.runtime.sendMessage({ type: "summarizeNow" }, (r) => {
      body.textContent = r?.ok ? r.summary.text : "Error: " + (r?.error || "failed");
      updateStatus();
    });
  }

  setInterval(updateStatus, 3000);
  setTimeout(refresh, 2500);
})();
