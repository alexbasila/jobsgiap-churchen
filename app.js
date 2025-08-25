"use strict";

/* ========= Config ========= */
const API_BASE = "https://jobsgiap.com";  // fest auf deine Domain
const TOKEN_COST = 0.6;                    // UI-Abbuchung pro AI-Antwort

/* ====== Mini utils ====== */
const $ = s => document.querySelector(s);
const esc = s => String(s||"")
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;");
const setBusy=(el,b,txt="…")=>{ if(!el) return; el.disabled=!!b; if(b){el.dataset.t=el.textContent;el.textContent=txt;}else if(el.dataset.t){el.textContent=el.dataset.t; delete el.dataset.t;} };
const toast = m => { try{ alert(m) }catch{} };

/* ====== Tokens (UI) ====== */
const getBal = ()=> Number(localStorage.getItem("giap_tokens")||"0");
const setBal = v => { localStorage.setItem("giap_tokens", String(Math.max(0, Number(v)||0))); paintBal(); };
const addBal = v => setBal(getBal()+Number(v||0));
const spend  = v => setBal(Math.max(0, getBal()-Number(v||0)));
function paintBal(){
  $("#toknum").textContent = getBal().toFixed(2);
  const fill = $("#tokfill");
  const p = Math.max(0, Math.min(1, getBal()/10)); // 10 = willkürliche „volle“ Anzeige
  fill.style.width = `${p*100}%`;
}

/* ====== Fetch helper ====== */
async function parseRes(r){
  const ct=(r.headers.get("content-type")||"").toLowerCase();
  return ct.includes("json") ? r.json() : r.text();
}
async function GET(p){ const r=await fetch(API_BASE+p,{cache:"no-store"}); return {ok:r.ok,data:await parseRes(r)} }
async function POST(p,body){ const r=await fetch(API_BASE+p,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})}); return {ok:r.ok,data:await parseRes(r)} }

/* ====== Live memory ====== */
let LIVE=[];
function pushLive(list=[]){
  for(const m of list){ LIVE.unshift({who:m.who,title:m.title,tags:m.tags,source:m.source,score:m.score,id:m.id}); }
  LIVE = LIVE.slice(0,30);
  const ul=$("#live");
  ul.innerHTML = LIVE.length? "": `<li class="match muted">Noch nichts.</li>`;
  for(const m of LIVE){
    const li=document.createElement("li"); li.className="match";
    li.innerHTML = `<div style="font-weight:700">${esc(m.who||"GIAP user")}</div>
                    <div>${esc(m.title||"")}</div>
                    <div class="meta">${(m.tags||[]).join(", ")||"&nbsp;"}</div>
                    <div class="meta">src: ${esc(m.source||"-")} • score: ${m.score??"-"}</div>`;
    ul.appendChild(li);
  }
}

/* ====== Render Antwort & Referenzen ====== */
function renderAnswer(ans, refs){
  $("#result").style.display="";
  $("#answer").innerHTML = esc(ans || "(keine Antwort)");
  const ul=$("#refs"); ul.innerHTML="";
  const items = refs||[];
  if(!items.length){ ul.innerHTML = `<li class="muted">Keine Referenzen.</li>`; return; }
  for(const r of items){
    const li=document.createElement("li");
    const href = r.url || r.href || r.link || "#";
    li.innerHTML = `<div><a href="${esc(href)}" target="_blank" rel="noopener">${esc(r.title||href)}</a></div>
                    <div class="muted" style="font-size:12px">${esc(r.snippet||"")}</div>`;
    ul.appendChild(li);
  }
}

/* ====== Page wiring ====== */
document.addEventListener("DOMContentLoaded", () => {
  paintBal();

  $("#topup").addEventListener("click", ()=>{ addBal(5); toast("5 Tokens gutgeschrieben (Demo)"); });

  $("#clear").addEventListener("click", ()=>{
    $("#idea").value=""; $("#tags").value=""; $("#result").style.display="none"; $("#refs").innerHTML="";
  });

  $("#send").addEventListener("click", async ()=>{
    const text = ($("#idea").value||"").trim();
    const tags = ($("#tags").value||"").split(",").map(t=>t.trim()).filter(Boolean);
    if(!text){ toast("Bitte Text eingeben."); return; }

    setBusy($("#send"), true, "Churchen…");
    try{
      // 1) Primär: /api/churchen (liefert ideaId, matches, evtl. ai)
      const {ok, data} = await POST("/api/churchen", { text, tags });
      if(!ok){ toast("Fehler: " + (data?.error||"unknown")); return; }

      // 2) AI-Antwort ableiten (Backend kann verschiedene Felder liefern)
      const ai = data.ai || {};
      const answer = ai.answer || data.answer || ai.text || "";
      const refs = data.refs || ai.refs || data.matches || [];

      renderAnswer(answer, refs);
      pushLive(data.matches||[]);

      // Buttons
      $("#openjson").style.display="none";
      $("#copyid").onclick = async ()=>{ if(data.ideaId){ await navigator.clipboard.writeText(data.ideaId); toast("IdeaID kopiert."); } };

      $("#publish").onclick = async ()=>{
        if(!data.ideaId){ toast("Kein Ergebnis zum Veröffentlichen."); return; }
        const body = { ideaId: data.ideaId, text, tags, abstract: (text||"").slice(0,160) };
        const res = await POST("/api/publish", body);
        if(!res.ok || !res.data?.ok){ toast("Publish fehlgeschlagen."); return; }
        toast("Veröffentlicht! ✅");
        $("#openjson").style.display="";
        $("#openjson").onclick = ()=> window.open(`${API_BASE}/public/idea/${encodeURIComponent(res.data.idea?.id||data.ideaId)}`,"_blank","noopener");
      };

      // Token-Abbuchung, wenn AI genutzt
      if(ai.used) spend(TOKEN_COST);
    }catch(e){
      toast("Netzwerkfehler: "+e.message);
    }finally{
      setBusy($("#send"), false);
    }
  });
});
