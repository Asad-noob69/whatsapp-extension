// Renders the dashboard from data.json. The bot (WhatsApp summarizer extension)
// updates data.json in the repo; GitHub Pages / Vercel then serves the new site.

const el = (id) => document.getElementById(id);

const STATUS = {
  done:        { label: "Done",        cls: "bg-emerald-100 text-emerald-700" },
  in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-700" },
  planned:     { label: "Planned",     cls: "bg-slate-100 text-slate-600" },
  blocked:     { label: "Blocked",     cls: "bg-rose-100 text-rose-700" },
};

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

function pointsList(points) {
  if (!points || !points.length) return "";
  return `<ul class="mt-2 space-y-1 text-sm text-slate-600 list-disc list-inside">${
    points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")
  }</ul>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(data) {
  const p = data.project || {};
  el("proj-name").textContent = p.name || "Project";
  el("proj-tagline").textContent = p.tagline || "";
  el("proj-desc").textContent = p.description || "";
  el("updated-at").textContent = p.updatedAt ? "Updated " + fmtDate(p.updatedAt) : "";

  // Latest summary
  const ls = data.latestSummary;
  el("latest-summary").innerHTML = ls
    ? `<div class="text-xs text-slate-400 mb-2">${fmtDate(ls.at)}</div>
       <div class="whitespace-pre-wrap text-slate-700 leading-relaxed">${escapeHtml(ls.text)}</div>`
    : `<p class="text-slate-400 text-sm">No summary yet.</p>`;

  // Milestones
  el("milestones").innerHTML = (data.milestones || []).map((m) => {
    const st = STATUS[m.status] || STATUS.planned;
    return `<div class="card p-4">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-medium">${escapeHtml(m.title)}</h3>
        <span class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}">${st.label}</span>
      </div>
      ${m.detail ? `<p class="mt-1 text-sm text-slate-500">${escapeHtml(m.detail)}</p>` : ""}
    </div>`;
  }).join("") || `<p class="text-slate-400 text-sm">No milestones yet.</p>`;

  // Achievements
  el("achievements").innerHTML = (data.achievements || []).map((a) =>
    `<li class="flex gap-2"><span class="text-emerald-600">✓</span><span class="text-sm">${escapeHtml(a)}</span></li>`
  ).join("") || `<li class="text-slate-400 text-sm">Nothing logged yet.</li>`;

  // Daily
  el("daily").innerHTML = (data.daily || []).slice().reverse().map((d) =>
    `<div class="card p-4">
      <div class="text-xs font-semibold text-emerald-700">${escapeHtml(d.date || "")}</div>
      ${d.summary ? `<p class="mt-1 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(d.summary)}</p>` : ""}
      ${pointsList(d.points)}
    </div>`
  ).join("") || `<p class="text-slate-400 text-sm">No daily updates yet.</p>`;

  // Weekly
  el("weekly").innerHTML = (data.weekly || []).slice().reverse().map((w) =>
    `<div class="card p-4">
      <div class="text-xs font-semibold text-emerald-700">${escapeHtml(w.week || "")}</div>
      ${w.summary ? `<p class="mt-1 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(w.summary)}</p>` : ""}
      ${pointsList(w.points)}
    </div>`
  ).join("") || `<p class="text-slate-400 text-sm">No weekly updates yet.</p>`;
}

fetch("data.json?" + Date.now())
  .then((r) => r.json())
  .then(render)
  .catch((e) => {
    el("latest-summary").innerHTML = `<p class="text-rose-500 text-sm">Could not load data.json (${escapeHtml(e.message)}).</p>`;
  });
