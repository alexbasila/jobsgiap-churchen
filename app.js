// app.js — Churchen UI (GIAP) — v9
"use strict";

/* ==================== Config ==================== */
// Route über deine Domain (Worker ist an /api/* gemappt)
const API_BASE = "https://jobsgiap.com/api";
// Optional: Direkt auf Worker (Fallback)
// const API_BASE = "https://giap-api.csac6316.workers.dev";

// Kostenmodell (nur UI, kein Billing!)
const TOKEN_COST = 0.6;

/* ==================== Mini Utils ==================== */
const $ = (s)=>document.querySelector(s);
const esc = (s="") => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;");
function setBusy(el, on, label="…"){
  if(!el) return;
  el.disabled = !!on;
  if(on){ el.dataset._txt = el.textContent; el.textContent = label; }
  else if(el.dataset._txt){ el.textContent = el.dataset._txt; delete el.dataset._txt; }
}
function toast(m){ try{ alert(m) }catch{} }
function logBlock(title, obj){
  const pre=$("#log"); if(!pre) return;
  let txt=""; try{ txt = JSON.stringify(obj,null,2) } catch{ txt=String(obj) }
  pre.textContent = `${title?title+" ✓ ":""}${txt}\n\n` + pre.textContent;
}

/* ==================== Token Bar (UI) ==================== */
const BAL_KEY = "giap_tokens";
const USED_KEY = "giap_used";
function getBalance(){ return Number(localStorage.getItem(BAL_KEY)||"0"); }
function setBalance(v){ localStorage.setItem(BAL_KEY, String(Math.max(0, Number(v)||0))); renderBalance(); }
function addBalance(v){ setBalance(getBalance()+Number(v||0)); }
function addUsed(v){ const u=Number(localStorage.getItem(USED_KEY)||"0")+Number(v||0); localStorage.setItem(USED_KEY,String(u)); renderBalance(); }
function renderBalance(){
  const bal=getBalance().toFixed(2);
  const label=$("#balance-label"); if(label) label.textContent = `${bal}`;
  // Fortschritt rein kosmetisch: „verbrauchte Tokens heute“ vs. 10
  const u = Math.min(10, Number(localStorage.getItem(USED_KEY)||"0"));
  const fill=$("#meter-fill"); if(fill) fill.style.width = `${(u/10)*100}%`;
}

/* ==================== API helpers ==================== */
async function parseRes(res){
  const ct=(res.headers.get("content-type")||"").toLowerCase();
  return ct.includes("application/json") ? res.json() : res.text();
}
async function GET(path){
  const r = await fetch(`${API_BASE}${path}`, { method:"GET", cache:"no-store" });
  const data = await parseRes(r);
  return { ok:r.ok, data };
}
async function POST(path, body){
  const r = await fetch(`${API_BASE}${path}`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body||{})
  });
  const data = await parseRes(r);
  return { ok:r.ok, data };
}

/* ==================== Live Sidebar ==================== */
let LIVE = []; // {who,title,tags,source,score,id}
function pushLive(matches=[]){
  for(const m of (matches||[])){
    LIVE.unshift({ who:m.who, title:m.title, tags:m.tags, source:m.source, score:m.score, id:m.id });
  }
  LIVE = LIVE.slice(0,30);
  renderLive();
}
function renderLive(){
  const ul=$("#live"); if(!ul) return;
  ul.innerHTML = "";
  if (!LIVE.length){
    const li=document.createElement("li");
    li.className="muted";
    li.style.padding="10px";
    li.textContent="Noch keine Ergebnisse.";
    ul.appendChild(li);
    return;
  }
  for(const m of LIVE){
    const li=document.createElement("li");
    li.innerHTML = `
      <div style="font-weight:800">${esc(m.who||"GIAP user")}</div>
      <div>${esc(m.title||"")}</div>
      <div class="muted" style="font-size:12px">${(m.tags||[]).join(", ") || " "}</div>
      <div class="muted" style="font-size:12px">src: ${esc(m.source||"-")} • score: ${m.score ?? "-"}</div>
    `;
    // Farbe je nach Score (nur UI):
    let bg = "#0f172a";
    if (typeof m.score === "number"){
      if (m.score >= 0.75) bg = "#0e2f21";        // grünlich
      else if (m.score >= 0.45) bg = "#2a240b";   // gelblich
      else bg = "#2a1414";                        // rötlich
    }
    li.style.background = `linear-gradient(180deg, ${bg}, transparent 60%)`;
    ul.appendChild(li);
  }
}

/* ==================== Result rendering ==================== */
function renderAnswer(text=""){
  $("#answer").textContent = text || "(leer)";
}
function renderRefs(list=[]){
  const ul=$("#refs"); if(!ul) return;
  ul.innerHTML = "";
  if (!list.length){
    const li=document.createElement("li");
    li.className="muted";
    li.textContent="(keine Referenzen übermittelt)";
    ul.appendChild(li);
    return;
  }
  for(const r of list){
    const li=document.createElement("li");
    const title = r.title || r.who || r.source || "Quelle";
    const url = r.url || r.href || r.link;
    li.innerHTML = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`
      : esc(title);
    ul.appendChild(li);
  }
}

/* ==================== Public JSON Helper ==================== */
async function openPublicJsonById(id, fallback=null){
  const paths = [`/public/idea/${encodeURIComponent(id)}`, `/idea/${encodeURIComponent(id)}`];
  for(const p of paths){
    const {ok,data} = await GET(p);
    if(ok && data){
      const pretty = JSON.stringify(data,null,2);
      const blob = new Blob([pretty],{type:"application/json"});
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
      return;
    }
  }
  if (fallback){
    const blob = new Blob([JSON.stringify(fallback,null,2)],{type:"application/json"});
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  } else toast("Öffentliche JSON nicht gefunden.");
}

/* ==================== Page wiring ==================== */
document.addEventListener("DOMContentLoaded", () => {
  renderBalance();

  $("#btn-topup")?.addEventListener("click", ()=>{
    addBalance(5);
    toast("5 Tokens gutgeschrieben (Demo).");
  });

  // Senden per Button
  $("#btn-send")?.addEventListener("click", sendIdea);

  // Senden per Enter
  $("#idea")?.addEventListener("keydown", (ev)=>{
    if(ev.key === "Enter" && !ev.shiftKey){
      ev.preventDefault();
      sendIdea();
    }
  });

  // Mobil: Sidebar ein/aus
  $("#toggle-live")?.addEventListener("click", ()=>{
    const el=$("#live");
    if(!el) return;
    el.style.display = (el.style.display==="none") ? "" : "none";
  });
});

/* ==================== Main flow ==================== */
async function sendIdea(){
  const text = ($("#idea")?.value||"").trim();
  if(!text){ toast("Bitte zuerst deinen Gedanken schreiben."); return; }
  let tags = ($("#tags")?.value||"").split(",").map(t=>t.trim()).filter(Boolean);

  const btn=$("#btn-send");
  setBusy(btn, true, "Senden…");
  btn.classList.remove("draft");      // Farbe standard

  try{
    // 1) /churchen → IdeaID, Matches, AI-Nutzung
    const { ok, data } = await POST("/churchen", { text, tags });
    logBlock("churchen", data);

    if(!ok){
      toast("Fehler: " + (data?.error || "unknown"));
      return;
    }

    // Live-Matches
    pushLive(data.matches || []);

    // 2) Ergebnisfeld sichtbar
    $("#result").style.display = "";

    // 3) AI-Antwort (wenn Backend sie liefert), sonst kurzer Abstract
    const answerText =
      data.answer?.text ||
      data.ai?.text ||
      (data.matches?.[0]?.title ? `Ähnliche Idee: ${data.matches[0].title}` : "");

    renderAnswer(answerText);
    renderRefs(data.refs || data.matches || []);

    // 4) Status/Verbrauch
    const aiStatus = $("#ai-status");
    if (data.ai?.used){
      aiStatus.textContent = `AI used (${data.ai.model || "?"})`;
      aiStatus.className = "ok";
      // Verbrauch (nur UI) simulieren
      addUsed(TOKEN_COST);
      setBalance(Math.max(0, getBalance() - TOKEN_COST));
    }else if (data.ai?.error){
      aiStatus.textContent = `AI error: ${data.ai.error}`;
      aiStatus.className = "err";
    }else{
      aiStatus.textContent = "AI not used";
      aiStatus.className = "warn";
    }

    // 5) „Veröffentlichen“ & „JSON öffnen“
    const ideaId = data.ideaId || data.idea?.id || "";
    $("#openjson").style.display = ideaId ? "" : "none";
    $("#openjson").onclick = () => openPublicJsonById(ideaId, data.idea);

    $("#publish").onclick = async ()=>{
      if(!ideaId){ toast("Keine IdeaID vorhanden."); return; }
      const body = {
        ideaId,
        text,
        tags,
        abstract: (text||"").slice(0,160)
      };
      const r = await POST("/publish", body);
      logBlock("publish", r.data);
      toast(r.ok && r.data?.ok ? "Veröffentlicht! ✅" : ("Publish fehlgeschlagen: "+(r.data?.error||"unknown")));
    };

  }catch(e){
    toast("Netzwerkfehler: " + e.message);
  }finally{
    setBusy(btn, false);
  }
}
