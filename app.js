// app.js — GIAP Churchen UI — v10
"use strict";

/* =============== Config =============== */
// Deine Domain ist auf den Worker gemappt (Pages → Worker routes)
const API_BASE    = "https://jobsgiap.com/api";
// Drafts-Worker (Ingest → next-Link zur Draft-UI)
const DRAFTS_API  = "https://giap-drafts.csac6316.workers.dev";

// rein UI-seitig (Demo)
const TOKEN_COST = 0.6;

/* =============== Mini utils =============== */
const $ = (s)=>document.querySelector(s);
const esc = (s="") => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;");
function setBusy(el,on,label="…"){ if(!el) return; el.disabled=!!on; if(on){ el.dataset._txt=el.textContent; el.textContent=label; } else if(el.dataset._txt){ el.textContent=el.dataset._txt; delete el.dataset._txt; } }
function toast(m){ try{ alert(m) }catch{} }
function logBlock(title, obj){
  const pre=$("#log"); if(!pre) return;
  let txt=""; try{ txt = JSON.stringify(obj,null,2) } catch{ txt=String(obj) }
  pre.textContent = `${title?title+" ✓ ":""}${txt}\n\n` + pre.textContent;
}

/* =============== Token bar =============== */
const BAL_KEY="giap_tokens", USED_KEY="giap_used";
function getBalance(){ return Number(localStorage.getItem(BAL_KEY)||"0"); }
function setBalance(v){ localStorage.setItem(BAL_KEY,String(Math.max(0,Number(v)||0))); renderBalance(); }
function addBalance(v){ setBalance(getBalance()+Number(v||0)); }
function addUsed(v){ const u=Number(localStorage.getItem(USED_KEY)||"0")+Number(v||0); localStorage.setItem(USED_KEY,String(u)); renderBalance(); }
function renderBalance(){
  const b=$("#balance-label"); if(b) b.textContent = getBalance().toFixed(2);
  const u = Math.min(10, Number(localStorage.getItem(USED_KEY)||"0"));
  const fill=$("#meter-fill"); if(fill){ fill.style.background="linear-gradient(90deg,#22c55e,#16a34a)"; fill.style.width = `${(u/10)*100}%`; }
}

/* =============== API helpers =============== */
async function parseRes(res){ const ct=(res.headers.get("content-type")||"").toLowerCase(); return ct.includes("application/json") ? res.json() : res.text(); }
async function GET(path){ const r=await fetch(`${API_BASE}${path}`, {method:"GET",cache:"no-store"}); const data=await parseRes(r); return { ok:r.ok, data }; }
async function POST(path,body){ const r=await fetch(`${API_BASE}${path}`,{method:"POST",headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body||{})}); const data=await parseRes(r); return { ok:r.ok, data }; }

/* =============== Live sidebar =============== */
let LIVE=[]; // {who,title,tags,source,score,id}
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
  if (!LIVE.length){ const li=document.createElement("li"); li.className="muted"; li.style.padding="10px"; li.textContent="Noch keine Ergebnisse."; ul.appendChild(li); return; }
  for(const m of LIVE){
    const li=document.createElement("li");
    const score = typeof m.score==="number" ? m.score : "-";
    // Hintergrund je nach Score
    let bg="#0f172a";
    if (typeof m.score==="number"){
      if (m.score>=0.75) bg="#0e2f21";
      else if (m.score>=0.45) bg="#2a240b";
      else bg="#2a1414";
    }
    li.style.background = `linear-gradient(180deg, ${bg}, transparent 65%)`;
    li.innerHTML = `
      <div style="font-weight:800">${esc(m.who||"GIAP user")}</div>
      <div>${esc(m.title||"")}</div>
      <div class="muted" style="font-size:12px">${(m.tags||[]).join(", ") || " "}</div>
      <div class="muted" style="font-size:12px">src: ${esc(m.source||"-")} • score: ${score}</div>
    `;
    ul.appendChild(li);
  }
}

/* =============== Result rendering =============== */
function renderAnswer(text=""){ $("#answer").textContent = text || "(leer)"; }
function renderRefs(list=[]){
  const ul=$("#refs"); if(!ul) return; ul.innerHTML="";
  if (!list.length){ const li=document.createElement("li"); li.className="muted"; li.textContent="(keine Referenzen übermittelt)"; ul.appendChild(li); return; }
  for(const r of list){
    const li=document.createElement("li");
    const title = r.title || r.who || r.source || "Quelle";
    const url = r.url || r.href || r.link;
    li.innerHTML = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>` : esc(title);
    ul.appendChild(li);
  }
}

/* =============== Public JSON helper =============== */
async function openPublicJsonById(id,fallback=null){
  const paths=[`/public/idea/${encodeURIComponent(id)}`,`/idea/${encodeURIComponent(id)}`];
  for(const p of paths){ const {ok,data}=await GET(p); if(ok && data){ const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); window.open(URL.createObjectURL(blob),"_blank","noopener"); return; } }
  if (fallback){ const blob=new Blob([JSON.stringify(fallback,null,2)],{type:"application/json"}); window.open(URL.createObjectURL(blob),"_blank","noopener"); }
  else toast("Öffentliche JSON nicht gefunden.");
}

/* =============== Page wiring =============== */
document.addEventListener("DOMContentLoaded", ()=>{
  renderBalance();
  $("#btn-topup")?.addEventListener("click",()=>{ addBalance(5); toast("5 Tokens gutgeschrieben (Demo)."); });
  $("#btn-health")?.addEventListener("click", checkHealth);
  $("#btn-send")?.addEventListener("click", sendIdea);
  $("#idea")?.addEventListener("keydown",(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendIdea(); }});
  $("#btn-draft")?.addEventListener("click", openDraftIngest);
});

async function checkHealth(){
  const btn=$("#btn-health"); setBusy(btn,true,"Checking…");
  try{ const {ok,data}=await GET("/health"); logBlock("health",data); toast(ok?"API OK ✅":"API Fehler ❌"); }catch(e){ toast("Fehler: "+e.message); }
  finally{ setBusy(btn,false); }
}

/* =============== Main flow =============== */
async function sendIdea(){
  const text = ($("#idea")?.value||"").trim();
  if(!text){ toast("Bitte zuerst deinen Gedanken schreiben."); return; }
  let tags = ($("#tags")?.value||"").split(",").map(t=>t.trim()).filter(Boolean);

  const btn=$("#btn-send"); setBusy(btn,true,"Senden…");

  try{
    const { ok, data } = await POST("/churchen", { text, tags });
    logBlock("churchen", data);
    if(!ok){ toast("Fehler: " + (data?.error || "unknown")); return; }

    pushLive(data.matches || []);
    $("#result").style.display = "";

    const answerText =
      data.answer?.text ||
      data.ai?.text ||
      (data.matches?.[0]?.title ? `Ähnliche Idee: ${data.matches[0].title}` : "");

    renderAnswer(answerText);
    renderRefs(data.refs || data.matches || []);

    const ideaId = data.ideaId || data.idea?.id || "";
    $("#openjson").style.display = ideaId ? "" : "none";
    $("#openjson").onclick = () => openPublicJsonById(ideaId, data.idea);

    const aiStatus=$("#ai-status");
    if (data.ai?.used){
      aiStatus.textContent = `AI used (${data.ai.model || "?"}) • IQ ${data.iq ?? "-"}`;
      aiStatus.className = "ok";
      addUsed(TOKEN_COST); setBalance(Math.max(0, getBalance()-TOKEN_COST));
    } else if (data.ai?.error){ aiStatus.textContent = `AI error: ${data.ai.error}`; aiStatus.className="err"; }
      else { aiStatus.textContent = `AI not used • IQ ${data.iq ?? "-"}`; aiStatus.className="warn"; }

    $("#publish").onclick = async ()=>{
      if(!ideaId){ toast("Keine IdeaID vorhanden."); return; }
      const body = { ideaId, text, tags, abstract: (text||"").slice(0,160) };
      const r = await POST("/publish", body);
      logBlock("publish", r.data);
      toast(r.ok && r.data?.ok ? "Veröffentlicht! ✅" : ("Publish fehlgeschlagen: "+(r.data?.error||"unknown")));
    };

  }catch(e){
    toast("Netzwerkfehler: " + e.message);
  }finally{
    setBusy(btn,false);
  }
}

/* =============== Drafts ingest (Button oben rechts) =============== */
async function openDraftIngest(){
  const text = ($("#idea")?.value||"").trim();
  const tags = ($("#tags")?.value||"").split(",").map(t=>t.trim()).filter(Boolean);
  if(!text){ toast("Für Drafts zuerst Text eingeben."); return; }

  const btn=$("#btn-draft"); setBusy(btn,true,"Ingest…");
  try{
    const r = await fetch(`${DRAFTS_API}/drafts/ingest`, {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ text, tags })
    });
    const j = await r.json().catch(()=>({}));
    logBlock("drafts_ingest", j);
    if (!r.ok || !j?.ok){ toast("Draft-Ingest fehlgeschlagen."); return; }
    const next = j.next || ""; if(next) window.open(next, "_blank", "noopener");
    else toast("Kein Draft-Link erhalten.");
  }catch(e){ toast("Fehler: "+e.message); }
  finally{ setBusy(btn,false); }
}
