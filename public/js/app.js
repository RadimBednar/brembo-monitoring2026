// ==========================================
// 1. PŘEKLADOVÝ SLOVNÍK (DATABÁZE -> MAPA)
// ==========================================
// Levá strana: Název z databáze | Pravá strana: ID stroje v SVG obrázku
const MAPOVANI_STROJU = {
  "IsolaPi.Presse_Bool.DB_SmartFactory_D_Macchina_Apertura_Stampo": "SAEFA040",
  "IsolaPi.Presse_Bool.DB_SmartFactory_A_Macchina_Apertura_Stampo": "SAESA033",
  "IsolaPi.Presse_Bool.DB_SmartFactory_B_Macchina_Apertura_Stampo": "SAESA037",
  "IsolaPi.Presse_Bool.DB_SmartFactory_C_Macchina_Apertura_Stampo": "SAESA004"
  // Zde si přidej všechny ostatní stroje
};

// ==========================================
// 2. POMOCNÉ FUNKCE A ZÁKLAD
// ==========================================
function formatujCas(datum) {
  if (!datum || isNaN(datum)) return "Neznámý čas";
  return datum.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const oddeleni = [
  { id: "cat-assembly", nazev: "Assembly" },
  { id: "cat-machining", nazev: "Machining" }
];

let linky = [];

const STAV_POJMENOVANI = { 
  active: "V provozu", 
  paused: "Stojí", 
  stopped: "Porucha" 
};

function prelozStavZDatabaze(dbStav) {
  if (!dbStav) return "stopped";
  const stavStr = dbStav.toString().toLowerCase();
  
  if (stavStr.includes("run") || stavStr.includes("active") || stavStr === "1") return "active";
  if (stavStr.includes("pause") || stavStr.includes("idle") || stavStr === "2") return "paused";
  return "stopped";
}

function getNejhorsiStav(stavy) {
  if (stavy.includes("stopped")) return "stopped";
  if (stavy.includes("paused")) return "paused";
  return "active";
}

function spoctiStavLinky(linka) {
  if (!linka.stanice || linka.stanice.length === 0) return "stopped";
  return getNejhorsiStav(linka.stanice.map(s => s.stav));
}

// ==========================================
// 3. VYKRESLOVÁNÍ KARET A DOM ELEMENTY
// ==========================================
const viewCategories = document.getElementById("view-categories");
const viewLines = document.getElementById("view-lines");
const viewDetail = document.getElementById("view-detail");

let aktivniKategorieId = null;
let aktivniLinkaId = null;

function renderCategories() {
  const container = document.getElementById("categories-grid");
  if (!container) return;
  
  container.innerHTML = oddeleni.map(odd => {
    const linkyVOddeleni = linky.filter(l => l.oddeleniId === odd.id);
    const pocetLinek = linkyVOddeleni.length;
    const bezici = linkyVOddeleni.filter(l => spoctiStavLinky(l) === "active").length;
    const vPoruse = linkyVOddeleni.filter(l => spoctiStavLinky(l) === "stopped").length;
    const stoji = linkyVOddeleni.filter(l => spoctiStavLinky(l) === "paused").length;
    
    return `
      <div class="category-card" onclick="otevriKategorii('${odd.id}')">
        <h2>${odd.nazev}</h2>
        <div style="margin-top: 15px; color: #94a3b8; font-size: 0.95rem;">
          Celkem strojů: <strong>${pocetLinek}</strong>
        </div>
        <div style="margin-top: 12px; font-size: 0.85rem; display: flex; justify-content: center; gap: 12px;">
          <span style="color: #22c55e;" title="V provozu">● ${bezici}</span>
          <span style="color: #f59e0b;" title="Stojí">● ${stoji}</span>
          <span style="color: #ef4444;" title="Porucha">● ${vPoruse}</span>
        </div>
      </div>
    `;
  }).join("");
}

window.otevriKategorii = function(katId) {
  aktivniKategorieId = katId;
  viewCategories.classList.add("hidden");
  viewLines.classList.remove("hidden");
  
  document.getElementById("lines-category-title").textContent = oddeleni.find(o => o.id === katId).nazev;
  renderLines();
};

function renderLines() {
  const linkyVybraneKategorie = linky.filter(l => l.oddeleniId === aktivniKategorieId);
  const container = document.getElementById("lines-grid");
  if (!container) return;
  
  container.innerHTML = linkyVybraneKategorie.map(linka => {
    const stav = spoctiStavLinky(linka);
    return `
      <div class="line-card ${stav}-border" onclick="otevriDetail('${linka.id}')">
        <div class="line-header">
          <span class="line-name">${linka.nazev}</span>
          <span class="status-badge ${stav}">${STAV_POJMENOVANI[stav] || stav}</span>
        </div>
        
        <div class="line-details" style="margin-top: 8px; font-size: 0.85rem; color: #cbd5e1; line-height: 1.5;">
          <div><strong>Kód v mapě:</strong> ${linka.kod}</div>
          <div><strong>Stav od:</strong> ${formatujCas(linka.casZmeny)}</div>
        </div>

        <div class="action-hint" style="margin-top: 15px;">Zobrazit detail →</div>
      </div>
    `;
  }).join("");
}

window.otevriDetail = function(lineId) {
  aktivniLinkaId = lineId;
  viewLines.classList.add("hidden");
  viewDetail.classList.remove("hidden");
  renderDetail();
};

function renderDetail() {
  const linka = linky.find(l => l.id == aktivniLinkaId);
  if(!linka) return;

  const stav = spoctiStavLinky(linka);
  
  document.getElementById("detail-line-name").textContent = `${linka.nazev}`;
  
  const badge = document.getElementById("detail-line-badge");
  badge.textContent = STAV_POJMENOVANI[stav] || stav;
  badge.className = `status-badge ${stav}`;

  document.getElementById("stations-grid").innerHTML = linka.stanice.map(stanice => `
    <div class="line-card ${stanice.stav}-border" style="cursor: default;">
      <div class="line-header">
        <span class="line-name">${stanice.nazev}</span>
        <span class="status-badge ${stanice.stav}">${STAV_POJMENOVANI[stanice.stav] || stanice.stav}</span>
      </div>
      <div class="line-details" style="margin-top: 8px; font-size: 0.85rem; color: #cbd5e1;">
        <div><strong>Změna:</strong> ${formatujCas(stanice.casZmeny)}</div>
      </div>
    </div>
  `).join("");
}

document.getElementById("btn-back-to-categories")?.addEventListener("click", () => {
  aktivniKategorieId = null;
  viewLines.classList.add("hidden");
  viewCategories.classList.remove("hidden");
  renderCategories();
});

document.getElementById("btn-back-to-lines")?.addEventListener("click", () => {
  aktivniLinkaId = null;
  viewDetail.classList.add("hidden");
  viewLines.classList.remove("hidden");
  renderLines();
});


// ==========================================
// 4. MAPA (SVG) A JEJÍ OBARVOVÁNÍ
// ==========================================
async function nactiMapu() {
  try {
    // OPRAVA 1: Cesta směřuje do složky assets
    const response = await fetch('/assets/floorplan_vectorized_.svg');
    const container = document.getElementById('map-container');
    if (container) {
      container.innerHTML = await response.text();
      
      // OPRAVA 2: Vyhledá všechny elementy (g, path, rect), které mají atribut ID
      const vsechnyStroje = container.querySelectorAll('[id]');
      vsechnyStroje.forEach(stroj => stroj.classList.add('svg-stroj'));
    }
  } catch (error) {
    console.error("SVG Mapu se nepodařilo načíst:", error);
  }
}

function aktualizujBarvyNaMape() {
  linky.forEach(linka => {
    const svgId = linka.kod; 
    if (!svgId || svgId === "N/A") return;

    // Najdeme obdélníček/tvar v mapě podle jeho ID
    const strojElement = document.getElementById(svgId);
    
    if (strojElement) {
      const stav = spoctiStavLinky(linka);
      
      // Vymažeme staré CSS třídy a přidáme tu aktuální (active, paused, stopped)
      strojElement.classList.remove("active", "paused", "stopped");
      strojElement.classList.add(stav);
      
      // Přidáme kliknutí, které otevře detail daného stroje
      strojElement.onclick = () => otevriDetail(linka.id);
    }
  });
}


// ==========================================
// 5. NAČÍTÁNÍ DAT Z DATABÁZE
// ==========================================
async function nactiLiveData() {
  try {
    const response = await fetch('/api/lines');
    const vysledek = await response.json();

    if (vysledek.success) {
      linky = vysledek.data.map(zaznam => {
        // Vyhledání kódu ve slovníku (pokud nenajde, vrátí "N/A")
        const prirazenyKod = MAPOVANI_STROJU[zaznam.name] || "N/A";
        
        return {
          id: zaznam.id,
          nazev: zaznam.name || "Neznámá linka",
          kod: prirazenyKod,
          oddeleniId: "cat-assembly", 
          casZmeny: new Date(zaznam.timestamp),
          stanice: [
            { 
              id: zaznam.id + "_S1", 
              nazev: "Hlavní proces", 
              stav: prelozStavZDatabaze(zaznam.status), 
              casZmeny: new Date(zaznam.timestamp) 
            }
          ]
        };
      });
    }
  } catch (chyba) {
    console.error("Nepodařilo se spojit se serverem.", chyba);
  }

  // Překreslení
  if (aktivniLinkaId) renderDetail();
  else if (aktivniKategorieId) renderLines();
  else renderCategories();
  
  // Obarvení mapy
  aktualizujBarvyNaMape();
}

// Spuštění po zapnutí webu
nactiMapu().then(() => {
  nactiLiveData();
});

// Automatický refresh každých 5 sekund
setInterval(nactiLiveData, 5000);