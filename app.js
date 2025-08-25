// app.js — V8 (Standalone UI, tokens, live sidebar)
"use strict";

/* ================= Config ================= */
const API_BASE = "https://giap-api.csac6316.workers.dev"; // dein Worker
const TOKEN_COST = 0.6; // Beispielkosten pro „AI used“ (nur UI)

/* ============== Mini utils ============== */
const $ = (sel) => document.querySelector(sel);
const esc = (s="") => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;");

function setBusy(btn, busy, label="…"){
  if(!btn) return;
  btn.disabled = !!busy;
  if(busy){ btn.dataset._txt = btn.textContent; btn.textContent = label; }
  else if(btn.dataset._txt){ btn.textContent = btn.dataset._txt; delete btn.dataset._txt; }
}
function toast(m){ try{ alert(m) }catch{} }
function logBlock(title, obj){
  const pre = $("#log"); if(!pre) return;
  let txt=""; try{ txt = JSON.stringify(obj,null,2) } catch{ txt = String(obj) }
  pre.textContent = `${title ? title+" ✓ " : ""}{\n${txt}\n}\n\n` + pre.textContent;
}

/* ============== Token balance (UI) ============== */
function getBalance(){ return Number(localStorage.getItem("giap_tokens")||"0"); }
function setBalance(v){ localStorage.setItem("giap_tokens", String(Math.max(0, Number(v)||0))); renderBalance(); }
function addBalance(v){ setBalance(getBalance() + Number(v||0)); }
function spendBalance(v){ setBalance(Math.max(0, getBalance() - Number(v||0))); }
function renderBalance(){ const b=$("#balance"); if(b) b.textContent = `${getBalance().toFixed(2)} Tokens`; }

/* ============== API helpers ============== */
async function parseRes(res){
  const ct=(res.headers.get("content-type")||"").toLowerCase();
  return ct.includes("application/json") ? res.json() : res.text();
}
async function GET(path){
  // probiere /api/* und Root-Fallback (für Health)
  const urls = [`${API_BASE}${path}`, `${API_BASE}${path.replace(/^\/api/,"")}`];
  for (const u of urls){
    try{
      const r = await fetch(u, { method:"GET", cache:"no-store" });
      const data = await parseRes(r);
      if (r.ok) return { ok:true, data };
      return { ok:false, data };
    }catch(_){}
  }
  return { ok:false, data:{ error:"network" } };
}
async function POST(path, body){
  const r = await fetch(`${API_BASE}${path}`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body||{})
  });
  const data = await parseRes(r);
  return { ok:r.ok, data };
}

/* ============== Public JSON open ============== */
async function openPublicJsonById(ideaId, fallback = null){
  const candidates = [
    `/public/idea/${encodeURIComponent(ideaId)}`,
    `/api/idea/${encodeURIComponent(ideaId)}`
  ];
  for (const p of candidates){
    const { ok, data } = await GET(p);
    if (ok && data){
      const pretty = JSON.stringify(data, null, 2);
      const blob = new Blob([pretty], { type:"application/json" });
      const href = URL.createObjectURL(blob);
      window.open(href, "_blank", "noopener");
      return;
    }
  }
  if (fallback){
    const blob = new Blob([JSON.stringify(fallback,null,2)], { type:"application/json" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  } else {
    toast("Öffentliche JSON nicht gefunden.");
  }
}

/* ============== Live sidebar memory ============== */
let LIVE = []; // {who,title,tags,source,score,id}
function pushLive(matches=[]){
  for(const m of (matches||[])){
    LIVE.unshift({ who:m.who, title:m.title, tags:m.tags, source:m.source, score:m.score, id:m.id });
  }
  LIVE = LIVE.slice(0,30);
  renderLive();
}
function renderLive(){
  const ul = $("#live"); if(!ul) return;
  ul.innerHTML = LIVE.length ? "" : `<li class="muted" style="padding:10px">Noch keine Ergebnisse.</li>`;
  for(const m of LIVE){
    const li = document.createElement("li");
    li.className="match";
    li.innerHTML = `
      <div style="font-weight:700">${esc(m.who||"GIAP user")}</div>
      <div>${esc(m.title||"")}</div>
      <div class="meta">${(m.tags||[]).join(", ") || "&nbsp;"}</div>
      <div class="meta">src: ${esc(m.source||"-")} • score: ${m.score ?? "-"}</div>
    `;
    ul.appendChild(li);
  }
}

/* ============== Render helpers ============== */
function renderMatches(list=[]){
  const ul = $("#matches"); if(!ul) return;
  ul.innerHTML = "";
  for(const m of list){
    const li = document.createElement("li");
    li.className = "match";
    li.innerHTML = `
      <div style="font-weight:700">${esc(m.who||"GIAP")}</div>
      <div>${esc(m.title||"")}</div>
      <div class="meta">${(m.tags||[]).join(", ")}</div>
      <div class="meta">src: ${m.source||"-"} • score: ${m.score ?? "-"}</div>
    `;
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.style.marginTop = "6px";
    btn.textContent = "JSON";
    btn.onclick = () => {
      if (m.id) openPublicJsonById(m.id, { id:m.id, who:m.who, title:m.title, tags:m.tags||[] });
      else toast("Für diesen Match gibt es keine ID.");
    };
    const wrap = document.createElement("div");
    wrap.style.marginTop = "6px";
    wrap.appendChild(btn);
    li.appendChild(wrap);
    ul.appendChild(li);
  }
}
function renderFeed(items=[]){
  const ul = $("#feed"); if(!ul) return;
  ul.innerHTML = "";
  if (!items.length){
    const li = document.createElement("li");
    li.className="match";
    li.textContent = "(leer)";
    ul.appendChild(li);
    return;
  }
  for(const it of items){
    const li = document.createElement("li");
    li.className="match";
    const when = it.createdAt ? new Date(it.createdAt).toLocaleString() : "";
    li.innerHTML = `
      <div style="font-weight:700">${esc(it.id || "(ohne ID)")}</div>
      <div>${esc((it.text||it.abstract||"").slice(0,160))}</div>
      <div class="meta">${(it.tags||[]).join(", ")} ${when ? "• "+esc(when) : ""}</div>
    `;
    const btn = document.createElement("button");
    btn.className="secondary";
    btn.style.marginTop="6px";
    btn.textContent="JSON";
    btn.onclick = () => openPublicJsonById(it.id, it);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

/* ============== Page wiring ============== */
document.addEventListener("DOMContentLoaded", () => {
  renderBalance();

  // Top-up (Demo)
  $("#btn-topup")?.addEventListener("click", () => {
    addBalance(5);
    toast("5 Tokens gutgeschrieben (Demo).");
  });

  // Health
  $("#btn-health")?.addEventListener("click", async () => {
    const btn = $("#btn-health");
    setBusy(btn, true, "Checking…");
    try{
      // probiere /api/health und /health
      let res = await GET("/api/health");
      if (!res.ok) res = await GET("/health");
      logBlock("Health", res.data);
      toast(res.ok ? "API OK ✅" : "API Fehler ❌");
    } catch(e){
      toast("Fehler: " + e.message);
    } finally {
      setBusy(btn, false);
    }
  });

  // Churchen
  $("#btn-churchen")?.addEventListener("click", async () => {
    const text = ($("#idea")?.value || "").trim();
    let tags = ($("#tags")?.value || "").split(",").map(t=>t.trim()).filter(Boolean);
    if ($("#force-gpt")?.checked) tags.push("force:heritage");

    if (!text){ toast("Bitte zuerst eine Idee eingeben."); return; }

    const btn = $("#btn-churchen");
    setBusy(btn, true, "Churchen…");
    $("#ai-status").textContent = "";
    try{
      const { ok, data } = await POST("/api/churchen", { text, tags });
      if (!ok){ toast("Fehler: " + (data?.error || "unknown")); setBusy(btn,false); return; }

      // Ergebnis anzeigen
      $("#out").style.display = "";
      $("#ideaId").value = data.ideaId || "";
      $("#hash").value   = data.hash   || "";
      renderMatches(data.matches || []);
      pushLive(data.matches || []);
      logBlock("Churchen", data);

      // Tokens (nur UI) wenn AI benutzt
      if (data.ai?.used) spendBalance(TOKEN_COST);

      const aiEl = $("#ai-status");
      if (data.ai){
        aiEl.textContent = data.ai.used
          ? `AI used (${data.ai.model || "?"}) · proposed=${data.ai.proposed ?? "-"} · saved=${data.ai.saved ?? "-"}`
          : (data.ai.error ? `AI error: ${data.ai.error}` : "AI not used");
        aiEl.className = data.ai.used ? "okay" : (data.ai.error ? "err" : "warn");
      } else {
        aiEl.textContent = "AI status: n/a";
        aiEl.className = "muted";
      }

      // Reset publish state
      $("#btn-open-json").style.display = "none";
    } catch(e){
      toast("Netzwerkfehler: " + e.message);
    } finally {
      setBusy(btn, false);
    }
  });

  // Clear
  $("#btn-clear")?.addEventListener("click", () => {
    $("#idea").value = "";
    $("#tags").value = "";
    $("#ideaId").value = "";
    $("#hash").value = "";
    $("#out").style.display = "none";
    $("#matches").innerHTML = "";
    $("#ai-status").textContent = "";
  });

  // Publish
  $("#btn-publish")?.addEventListener("click", async () => {
    const ideaId = ($("#ideaId")?.value || "").trim();
    const text   = ($("#idea")?.value   || "").trim();
    let tags = ($("#tags")?.value || "").split(",").map(t=>t.trim()).filter(Boolean);
    if (!text || !ideaId){ toast("Bitte zuerst ›Churchen‹ ausführen."); return; }

    const btn = $("#btn-publish");
    setBusy(btn, true, "Publishing…");
    try{
      const body = { ideaId, text, tags, abstract: (text||"").slice(0,160) };
      const { ok, data } = await POST("/api/publish", body);
      if (!ok || !data?.ok){ toast("Publish fehlgeschlagen: " + (data?.error || "unknown")); return; }
      logBlock("Publish", data);
      toast("Veröffentlicht! ✅");
      $("#btn-open-json").style.display = "";
      $("#btn-open-json").onclick = () => openPublicJsonById(data.idea?.id || ideaId, data.idea);
    } catch(e){
      toast("Netzwerkfehler: " + e.message);
    } finally {
      setBusy(btn, false);
    }
  });

  // Copy IdeaID
  $("#btn-copy-ideal")?.addEventListener("click", async () => {
    const val = $("#ideaId")?.value || "";
    if (!val) { toast("Keine IdeaID vorhanden."); return; }
    try { await navigator.clipboard.writeText(val); toast("IdeaID kopiert."); }
    catch { toast("Kopieren nicht möglich."); }
  });

  // Feed
  $("#btn-feed")?.addEventListener("click", async () => {
    const btn = $("#btn-feed");
    setBusy(btn, true, "Loading…");
    try{
      const { ok, data } = await GET("/api/feed?limit=20");
      renderFeed(data?.items || []);
      logBlock("Feed", data);
      if (!ok) toast("Feed: Fehler");
    } catch(e){
      toast("Fehler beim Laden des Feeds: " + e.message);
    } finally {
      setBusy(btn, false);
    }
  });
});
