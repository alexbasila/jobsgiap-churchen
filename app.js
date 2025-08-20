// app.js
// === Konfiguration ===
const API_BASE = "https://giap-api.csac6316.workers.dev";

// === State ===
let LAST_CHURCHEN = null;       // { ideaId, hash, text, tags, matches }
let LAST_PUBLISHED_ID = null;   // string

// === Helpers ===
const $ = (sel) => document.querySelector(sel);

function setBusy(btn, busy, labelWhenBusy = "…") {
  if (!btn) return;
  btn.disabled = !!busy;
  if (busy) {
    btn.dataset.__label = btn.textContent;
    btn.textContent = labelWhenBusy;
  } else if (btn.dataset.__label) {
    btn.textContent = btn.dataset.__label;
    delete btn.dataset.__label;
  }
}

function logBlock(title, obj) {
  const pre = $("#log");
  if (!pre) return;
  const now = new Date().toLocaleString();
  const head = title ? `${title} ✓` : "";
  let txt = "";
  try { txt = JSON.stringify(obj, null, 2); } catch { txt = String(obj); }
  pre.textContent = `${head ? head + " " : ""}{\n${txt}\n}\n\n` + pre.textContent;
}

function toast(msg) {
  try { alert(msg); } catch {}
}

function renderMatches(list = []) {
  const ul = $("#matches");
  if (!ul) return;
  ul.innerHTML = "";
  for (const m of list) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div style="font-weight:700">${escapeHtml(m.who || "GIAP")}</div>
      <div style="margin:2px 0 6px">${escapeHtml(m.title || "")}</div>
      <div class="muted">
        ${(m.tags || []).join(", ")}<br/>
        src: ${m.source || "-"}, score: ${m.score ?? "-"}
      </div>
    `;
    ul.appendChild(li);
  }
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// === Elemente ===
const taIdea       = $("#idea");
const inpTags      = $("#tags");
const outId        = $("#ideaId");
const outHash      = $("#hash");
const btnChurchen  = $("#btn-churchen");
const btnClear     = $("#btn-clear");
const btnPublish   = $("#btn-publish");
const btnCopyId    = $("#btn-copy-ideal");
const btnOpenJson  = $("#btn-open-json");
const btnFeed      = $("#btn-feed");
const ulFeed       = $("#feed");

// Header-Buttons (per sichtbarem Text finden)
function findButton(label) {
  const btns = document.querySelectorAll("button, a[role='button']");
  for (const el of btns) {
    const t = (el.textContent || "").trim().toLowerCase();
    if (t === label.toLowerCase()) return el;
  }
  return null;
}
const checkBtn   = findButton("Check API");
const installBtn = findButton("Install");

// === Events / Verkabelung ===

// 0) API Health
if (checkBtn) {
  checkBtn.addEventListener("click", async () => {
    setBusy(checkBtn, true, "Checking…");
    try {
      const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      const data = await r.json();
      logBlock("Health", data);
      toast(r.ok ? "API OK ✅" : "API Fehler ❌");
    } catch (e) {
      toast("Fehler: " + e.message);
    } finally {
      setBusy(checkBtn, false);
    }
  });
}

// 1) Churchen
if (btnChurchen) {
  btnChurchen.addEventListener("click", async () => {
    const text = (taIdea?.value || "").trim();
    const tags = (inpTags?.value || "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    if (!text) {
      toast("Bitte zuerst eine Idee eingeben.");
      return;
    }

    setBusy(btnChurchen, true, "Churchen…");
    try {
      const r = await fetch(`${API_BASE}/api/churchen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tags })
      });
      const data = await r.json();

      if (!r.ok) {
        toast("Fehler: " + (data?.error || r.status));
        return;
      }

      // Anzeige füllen
      LAST_CHURCHEN = {
        ideaId: data.ideaId,
        hash: data.hash,
        text,
        tags,
        matches: data.matches || []
      };
      outId && (outId.value   = data.ideaId || "");
      outHash && (outHash.value = data.hash || "");
      renderMatches(data.matches || []);
      logBlock("Churchen", data);

      // Publish-JSON-Button erst mal verstecken bis nach Publish
      if (btnOpenJson) btnOpenJson.style.display = "none";
      LAST_PUBLISHED_ID = null;

    } catch (e) {
      toast("Netzwerkfehler: " + e.message);
    } finally {
      setBusy(btnChurchen, false);
    }
  });
}

// 2) Clear
if (btnClear) {
  btnClear.addEventListener("click", () => {
    if (taIdea) taIdea.value = "";
    if (inpTags) inpTags.value = "";
    if (outId) outId.value = "";
    if (outHash) outHash.value = "";
    renderMatches([]);
    LAST_CHURCHEN = null;
    LAST_PUBLISHED_ID = null;
    if (btnOpenJson) btnOpenJson.style.display = "none";
  });
}

// 3) Publish
if (btnPublish) {
  btnPublish.addEventListener("click", async () => {
    if (!LAST_CHURCHEN?.ideaId) {
      toast("Bitte zuerst ›Churchen‹ ausführen.");
      return;
    }
    setBusy(btnPublish, true, "Publishing…");
    try {
      const body = {
        ideaId: LAST_CHURCHEN.ideaId,
        text: LAST_CHURCHEN.text,
        tags: LAST_CHURCHEN.tags,
        abstract: LAST_CHURCHEN.text.slice(0, 160)
      };
      const r = await fetch(`${API_BASE}/api/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();

      if (!r.ok || !data?.ok) {
        toast("Publish fehlgeschlagen: " + (data?.error || r.status));
        return;
      }

      logBlock("Publish", data);
      toast("Veröffentlicht! ✅");

      LAST_PUBLISHED_ID = data.idea?.id || LAST_CHURCHEN.ideaId;
      if (btnOpenJson) btnOpenJson.style.display = ""; // zeigen

    } catch (e) {
      toast("Netzwerkfehler: " + e.message);
    } finally {
      setBusy(btnPublish, false);
    }
  });
}

// 4) Copy IdealID
if (btnCopyId) {
  btnCopyId.addEventListener("click", async () => {
    const val = outId?.value || LAST_CHURCHEN?.ideaId || "";
    if (!val) { toast("Keine IdeaID vorhanden."); return; }
    try {
      await navigator.clipboard.writeText(val);
      toast("IdeaID kopiert.");
    } catch {
      toast("Kopieren nicht möglich.");
    }
  });
}

// 5) Öffne öffentliche JSON
if (btnOpenJson) {
  btnOpenJson.style.display = "none"; // standardmäßig versteckt, bis publish
  btnOpenJson.addEventListener("click", () => {
    const id = LAST_PUBLISHED_ID || LAST_CHURCHEN?.ideaId;
    if (!id) { toast("Bitte zuerst veröffentlichen."); return; }
    const url = `${API_BASE}/api/idea/${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener");
  });
}

// 6) Feed laden
if (btnFeed && ulFeed) {
  btnFeed.addEventListener("click", async () => {
    setBusy(btnFeed, true, "Loading…");
    ulFeed.innerHTML = "";
    try {
      const r = await fetch(`${API_BASE}/api/feed?limit=20`, { cache: "no-store" });
      const data = await r.json();
      logBlock("Feed", data);
      const items = data?.items || [];
      if (!items.length) {
        const li = document.createElement("li");
        li.textContent = "(leer)";
        ulFeed.appendChild(li);
      } else {
        for (const it of items) {
          const li = document.createElement("li");
          li.innerHTML = `
            <div style="font-weight:700">${escapeHtml(it.id || "(ohne ID)")}</div>
            <div>${escapeHtml((it.text || it.abstract || "").slice(0, 160))}</div>
            <div class="muted">${(it.tags || []).join(", ")}</div>
          `;
          ulFeed.appendChild(li);
        }
      }
    } catch (e) {
      toast("Fehler beim Laden des Feeds: " + e.message);
    } finally {
      setBusy(btnFeed, false);
    }
  });
}

// 7) Install (Platzhalter)
if (installBtn) {
  installBtn.addEventListener("click", () => {
    toast("PWA-Install kommt im nächsten Schritt (manifest + sw.js).");
  });
}
