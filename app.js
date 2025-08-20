// app.js
// <- Falls deine Worker-URL anders ist, hier anpassen:
const API_BASE = "https://giap-api.csac6316.workers.dev";

// Kleiner Helfer: Button nach sichtbarem Text finden
function findButton(label) {
  const btns = document.querySelectorAll("button, a[role='button']");
  for (const el of btns) {
    const t = (el.textContent || "").trim().toLowerCase();
    if (t === label.toLowerCase()) return el;
  }
  return null;
}

// Verkabeln
(function wire() {
  const checkBtn = findButton("Check API");
  if (checkBtn) {
    checkBtn.addEventListener("click", async () => {
      const old = checkBtn.textContent;
      checkBtn.disabled = true;
      checkBtn.textContent = "Checking…";
      try {
        const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
        const data = await r.json();
        checkBtn.textContent = r.ok ? "API OK ✅" : "API Fehler ❌";
        alert("API Health: " + JSON.stringify(data));
      } catch (e) {
        checkBtn.textContent = "API Fehler ❌";
        alert("Fehler: " + e.message);
      } finally {
        setTimeout(() => {
          checkBtn.textContent = old;
          checkBtn.disabled = false;
        }, 1500);
      }
    });
  }

  const installBtn = findButton("Install");
  if (installBtn) {
    installBtn.addEventListener("click", () => {
      alert("Install/PWA kommt im nächsten Schritt.");
    });
  }
})();
