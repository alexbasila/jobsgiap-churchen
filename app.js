// app.js  (V3 – DOM-sicher + einheitliche API_BASE)

// === Konfiguration ===
const API_BASE = "https://giap-api.csac6316.workers.dev";

// kleine Utilities
const $ = (sel) => document.querySelector(sel);
const escapeHtml = (s = "") =>
  String(s).replaceAll("&","&amp;").replaceAll("<","&lt;")
           .replaceAll(">","&gt;").replaceAll('"',"&quot;");
function setBusy(btn, busy, labelWhenBusy="…"){
  if (!btn) return;
  btn.disabled = !!busy;
  if (busy){ btn.dataset.__label = btn.textContent; btn.textContent = labelWhenBusy; }
  else if (btn.dataset.__label){ btn.textContent = btn.dataset.__label; delete btn.dataset.__label; }
}
function logBlock(title, obj){
  const pre = $("#log"); if (!pre) return;
  const head = title ? `${title} ✓` : "";
  let txt=""; try { txt = JSON.stringify(obj, null, 2); } catch { txt = String(obj); }
  pre.textContent = `${head ? head+" " : ""}{\n${txt}\n}\n\n` + pre.textContent;
}
function toast(msg){ try{ alert(msg); }catch{} }
function renderMatches(list=[]){
  const ul = $("#matches"); if (!ul) return;
  ul.innerHTML = "";
  for (const m of list){
    const li = document.createElement("li");
    li.innerHTML = `
      <div style="font-weight:700">${escapeHtml(m.who || "GIAP")}</div>
      <div style="margin:2px 0 6px">${escapeHtml(m.title || "")}</div>
      <div class="muted">
        ${(m.tags || []).join(", ")}<br/>
        src: ${m.source || "-"}, score: ${m.score ?? "-"}
      </div>`;
    ul.appendChild(li);
  }
}

// globaler UI-State
let LAST_CHURCHEN = null;     // { ideaId, hash, text, tags, matches }
let LAST_PUBLISHED_ID = null; // string

// ---- Alles erst verkabeln, NACHDEM der DOM fertig ist ----
document.addEventListener("DOMContentLoaded", () => {

  // Elemente
  const taIdea       = $("#idea");
  const inpTags      = $("#tags");
  const outId        = $("#ideaId");
  const outHash      = $("#hash");
  const btnChurchen  = $("#btn-churchen");
  const btnClear     = $("#btn-clear");
  const btnPublish   = $("#btn-publish");
  const btnCopyId    = $("#btn-copy-ideal");   // prüfe: id muss in HTML exakt so heißen
  const btnOpenJson  = $("#btn-open-json");
  const btnFeed      = $("#btn-feed");
  const ulFeed       = $("#feed");

  // Header-Buttons über Text finden (Check API / Install)
  function findButton(label){
    const btns = document.querySelectorAll("button, a[role='button']");
    for (const el of btns){
      const t = (el.textContent || "").trim().toLowerCase();
      if (t === label.toLowerCase()) return el;
    }
    return null;
  }
  const checkBtn   = findButton("Check API");
  const installBtn = findButton("Install");

  // 0) API Health
  if (checkBtn){
    checkBtn.addEventListener("click", async () => {
      setBusy(checkBtn, true, "Checking…");
      try{
        const r = await fetch(`${API_BASE}/health`, { cache:"no-store" });
        const data = await r.json();
        logBlock("Health", data);
        toast(r.ok ? "API OK ✅" : "API Fehler ❌");
      }catch(e){ toast("Fehler: " + e.message); }
      finally{ setBusy(checkBtn, false); }
    });
  }

  // 1) Churchen
  if (btnChurchen){
    btnChurchen.addEventListener("click", async () => {
      const text = (taIdea?.value || "").trim();
      const tags = (inpTags?.value || "").split(",").map(t=>t.trim()).filter(Boolean);
      if (!text){ toast("Bitte zuerst eine Idee eingeben."); return; }

      setBusy(btnChurchen, true, "Churchen…");
      try{
        const r = await fetch(`${API_BASE}/api/churchen`, {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ text, tags })
        });
        const data = await r.json();
        if (!r.ok){ toast("Fehler: " + (data?.error || r.status)); return; }

        LAST_CHURCHEN = {
          ideaId: data.ideaId, hash: data.hash, text, tags, matches: data.matches || []
        };
        if (outId)   outId.value   = data.ideaId || "";
        if (outHash) outHash.value = data.hash   || "";
        renderMatches(data.matches || []);
        logBlock("Churchen", data);

        LAST_PUBLISHED_ID = null;
        if (btnOpenJson) btnOpenJson.style.display = "none";
      }catch(e){ toast("Netzwerkfehler: " + e.message); }
      finally{ setBusy(btnChurchen, false); }
    });
  }

  // 2) Clear
  if (btnClear){
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
  if (btnPublish){
    btnPublish.addEventListener("click", async () => {
      if (!LAST_CHURCHEN?.ideaId){ toast("Bitte zuerst ›Churchen‹ ausführen."); return; }
      setBusy(btnPublish, true, "Publishing…");
      try{
        const body = {
          ideaId: LAST_CHURCHEN.ideaId,
          text: LAST_CHURCHEN.text,
          tags: LAST_CHURCHEN.tags,
          abstract: LAST_CHURCHEN.text.slice(0,160)
        };
        const r = await fetch(`${API_BASE}/api/publish`, {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify(body)
        });
        const data = await r.json();
        if (!r.ok || !data?.ok){ toast("Publish fehlgeschlagen: " + (data?.error || r.status)); return; }

        logBlock("Publish", data);
        toast("Veröffentlicht! ✅");

        LAST_PUBLISHED_ID = data.idea?.id || LAST_CHURCHEN.ideaId;
        if (btnOpenJson) btnOpenJson.style.display = ""; // Button wird sichtbar
      }catch(e){ toast("Netzwerkfehler: " + e.message); }
      finally{ setBusy(btnPublish, false); }
    });
  }

  // 4) Copy IdeaID
  if (btnCopyId){
    btnCopyId.addEventListener("click", async () => {
      const val = outId?.value || LAST_CHURCHEN?.ideaId || "";
      if (!val){ toast("Keine IdeaID vorhanden."); return; }
      try{ await navigator.clipboard.writeText(val); toast("IdeaID kopiert."); }
      catch{ toast("Kopieren nicht möglich."); }
    });
  }

  // 5) Öffentliche JSON (mit HEAD-Check + Fallback data:URL)
  async function openPublicJson(){
    const ideaId = (outId?.value || LAST_PUBLISHED_ID || LAST_CHURCHEN?.ideaId || "").trim();
    if (!ideaId){ toast("Bitte zuerst veröffentlichen."); return; }
    const url = `${API_BASE}/public/idea/${encodeURIComponent(ideaId)}`;

    try{
      const head = await fetch(url, { method:"HEAD", cache:"no-store" });
      if (head.ok){ window.open(url, "_blank", "noopener"); return; }
    }catch{ /* fällt auf Fallback */ }

    // Fallback: lokale JSON aus aktuellen Feldern
    const local = {
      id: ideaId,
      hash: (outHash?.value || "").trim(),
      title: (taIdea?.value || "").trim(),
      tags: (inpTags?.value || "").split(",").map(t=>t.trim()).filter(Boolean),
      source: "local-fallback",
      note: "Server-Eintrag nicht gefunden — zeige lokale JSON-Ansicht."
    };
    const blob = new Blob([JSON.stringify(local, null, 2)], { type:"application/json" });
    const href = URL.createObjectURL(blob);
    window.open(href, "_blank", "noopener");
  }
  if (btnOpenJson){
    btnOpenJson.style.display = "none"; // erst nach Publish zeigen
    btnOpenJson.addEventListener("click", openPublicJson);
  }

  // 6) Feed
  if (btnFeed && ulFeed){
    btnFeed.addEventListener("click", async () => {
      setBusy(btnFeed, true, "Loading…");
      ulFeed.innerHTML = "";
      try{
        const r = await fetch(`${API_BASE}/api/feed?limit=20`, { cache:"no-store" });
        const data = await r.json();
        logBlock("Feed", data);
        const items = data?.items || [];
        if (!items.length){
          const li = document.createElement("li"); li.textContent = "(leer)"; ulFeed.appendChild(li);
        } else {
          for (const it of items){
            const li = document.createElement("li");
            li.innerHTML = `
              <div style="font-weight:700">${escapeHtml(it.id || "(ohne ID)")}</div>
              <div>${escapeHtml((it.text || it.abstract || "").slice(0,160))}</div>
              <div class="muted">${(it.tags || []).join(", ")}</div>`;
            ulFeed.appendChild(li);
          }
        }
      }catch(e){ toast("Fehler beim Laden des Feeds: " + e.message); }
      finally{ setBusy(btnFeed, false); }
    });
  }

  // 7) Install (Stub)
  if (installBtn){
    installBtn.addEventListener("click", () => {
      toast("PWA-Install kommt im nächsten Schritt (manifest + sw.js).");
    });
  }

}); // DOMContentLoaded
