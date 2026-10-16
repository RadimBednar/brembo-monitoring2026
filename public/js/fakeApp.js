// ==========================================
// 1. POMOCNÉ FUNKCE A ZÁKLAD
// ==========================================
function formatujCas(datum) {
  if (!datum || isNaN(datum)) return "Neznámý čas";
  return datum.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const oddeleni = [
  { id: "cat-assembly", nazev: "Assembly" },
  { id: "cat-machining", nazev: "Machining" }
];

// NOVÉ: Jaká mapa patří k jakému oddělení
const MAPY_ODDELENI = {
  "cat-assembly": "floorplan_vectorized_.svg",
  "cat-machining": "foundry_plan_exact.svg"
};

let linky = [];

const STAV_POJMENOVANI = { 
  active: "V provozu", 
  paused: "Stojí", 
  stopped: "Porucha" 
};

function spoctiStavLinky(linka) {
  if (!linka.stanice || linka.stanice.length === 0) return "stopped";
  return linka.stanice[0].stav; 
}

// ==========================================
// 2. VYKRESLOVÁNÍ KARET A DOM ELEMENTY
// ==========================================
const viewCategories = document.getElementById("view-categories");
const viewLines = document.getElementById("view-lines");
const viewDetail = document.getElementById("view-detail");
const viewStationDetail = document.getElementById("view-station-detail"); // Nová obrazovka

let aktivniKategorieId = null;
let aktivniLinkaId = null;
let aktivniStaniceId = null; // Pamatuje si, na jakou ST klikl

function renderCategories() {
  const container = document.getElementById("categories-grid");
  if (!container) return;
  
  container.innerHTML = oddeleni.map(odd => {
    const linkyVOddeleni = linky.filter(l => l.oddeleniId === odd.id);
    const pocetLinek = linkyVOddeleni.length;
    
    // Výpočty pro všechny tři stavy
    const bezici = linkyVOddeleni.filter(l => spoctiStavLinky(l) === "active").length;
    const stoji = linkyVOddeleni.filter(l => spoctiStavLinky(l) === "paused").length;
    const vPoruse = linkyVOddeleni.filter(l => spoctiStavLinky(l) === "stopped").length;
    
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

window.otevriKategorii = async function(katId) {
  aktivniKategorieId = katId;
  viewCategories.classList.add("hidden");
  viewLines.classList.remove("hidden");
  document.getElementById("lines-category-title").textContent = oddeleni.find(o => o.id === katId).nazev;
  
  // NOVÉ: Dynamické načtení správné mapy podle kliknutí
  const souborMapy = MAPY_ODDELENI[katId];
  if (souborMapy) {
    await nactiMapu(souborMapy);
    aktualizujBarvyNaMape(); // Obarví nově načtenou mapu podle dat
  }
  
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
          <span class="line-name" style="font-size: 1.3rem;">${linka.nazev}</span>
          <span class="status-badge ${stav}">${STAV_POJMENOVANI[stav] || stav}</span>
        </div>
        
        <div class="line-details" style="margin-top: 5px; line-height: 1.5;">
          <div style="font-size: 1rem; color: #94a3b8; font-family: monospace;">${linka.kod}</div>
          <div style="margin-top: 12px; font-size: 0.85rem; color: #cbd5e1;"><strong>Stav od:</strong> ${formatujCas(linka.casZmeny)}</div>
        </div>
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

  // Vykreslení stanic s ověřením, zda mají podprocesy
  document.getElementById("stations-grid").innerHTML = linka.stanice.map(stanice => {
    const maSubprocesy = stanice.subprocesy && stanice.subprocesy.length > 0;
    const actionAttr = maSubprocesy ? `onclick="otevriStanici('${stanice.id}')"` : '';
    const cursorStyle = maSubprocesy ? 'cursor: pointer;' : 'cursor: default;';
    const hintText = maSubprocesy ? `<div style="margin-top: 12px; font-size: 0.8rem; color: #38bdf8;">Zobrazit procesy →</div>` : '';

    return `
      <div class="line-card ${stanice.stav}-border" style="${cursorStyle}" ${actionAttr}>
        <div class="line-header">
          <span class="line-name">${stanice.nazev}</span>
          <span class="status-badge ${stanice.stav}">${STAV_POJMENOVANI[stanice.stav] || stanice.stav}</span>
        </div>
        <div class="line-details" style="margin-top: 8px; font-size: 0.85rem; color: #cbd5e1;">
          <div><strong>Změna:</strong> ${formatujCas(stanice.casZmeny)}</div>
        </div>
        ${hintText}
      </div>
    `;
  }).join("");
}

// ------------------------------------------
// 2.5 NOVÉ: LOGIKA PRO DETAIL STANICE (4. ÚROVEŇ)
// ------------------------------------------
window.otevriStanici = function(staniceId) {
  aktivniStaniceId = staniceId;
  viewDetail.classList.add("hidden");
  viewStationDetail.classList.remove("hidden");
  renderStationDetail();
};

function renderStationDetail() {
  const linka = linky.find(l => l.id == aktivniLinkaId);
  const stanice = linka.stanice.find(s => s.id == aktivniStaniceId);
  
  if(!stanice || !stanice.subprocesy) return;

  document.getElementById("detail-station-title").textContent = `${linka.nazev} - ${stanice.nazev}`;

  document.getElementById("subprocesses-grid").innerHTML = stanice.subprocesy.map(sp => `
    <div class="line-card ${sp.stav}-border" style="cursor: default;">
      <div class="line-header">
        <span class="line-name" style="font-size: 1.05rem;">${sp.nazev}</span>
        <span class="status-badge ${sp.stav}">${STAV_POJMENOVANI[sp.stav] || sp.stav}</span>
      </div>
      <div class="line-details" style="margin-top: 10px; font-size: 0.95rem; color: #94a3b8; font-family: monospace;">
        ${sp.kod}
      </div>
    </div>
  `).join("");
}

// ------------------------------------------
// NAVIGACE - TLAČÍTKA ZPĚT
// ------------------------------------------
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

// Zpět ze stanice na seznam stanic (linku)
document.getElementById("btn-back-to-line-detail")?.addEventListener("click", () => {
  aktivniStaniceId = null;
  viewStationDetail.classList.add("hidden");
  viewDetail.classList.remove("hidden");
});


// ==========================================
// 3. MAPA (SVG) A JEJÍ OBARVOVÁNÍ
// ==========================================
// Změna: Funkce nyní přijímá parametr "nazevSouboru"
async function nactiMapu(nazevSouboru) {
  try {
    // Použijeme parametr v URL adrese
    const response = await fetch(`/assets/${nazevSouboru}?v=` + new Date().getTime());
    const container = document.getElementById('map-container');
    if (container) {
      container.innerHTML = await response.text();
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
    if (!svgId) return;

    const strojElement = document.getElementById(svgId);
    if (strojElement) {
      const stav = spoctiStavLinky(linka);
      strojElement.classList.remove("active", "paused", "stopped");
      strojElement.classList.add(stav);
      strojElement.onclick = () => otevriDetail(linka.id);
    }
  });
}

// ==========================================
// 4. FAKE DATA
// ==========================================
async function nactiLiveData() {
  linky = [
    // =========================================
    // 1. ODDĚLENÍ: ASSEMBLY
    // =========================================
    {
      id: "1",
      nazev: "EVO 40",
      kod: "SAEFA040",
      oddeleniId: "cat-assembly", 
      casZmeny: new Date(),
      stanice: [
        { id: "1_S010A", nazev: "Stanice ST010A", stav: "active", casZmeny: new Date() },
        { id: "1_S010B", nazev: "Stanice ST010B", stav: "active", casZmeny: new Date() },
        { 
          id: "1_S020", 
          nazev: "Stanice ST020", 
          stav: "active", 
          casZmeny: new Date(),
          // ZDE JSOU NOVÉ PODPROCESY (4. úroveň)
          subprocesy: [
            { nazev: "Laserové značení", kod: "20_S2_G1_Laser_DB20", stav: "active" },
            { nazev: "Průtokový test", kod: "20_S3G5_TLGB_FLOW20", stav: "active" },
            { nazev: "Lisování pouzder", kod: "20_S4_G6_Press_DB20", stav: "active" },
            { nazev: "TK44 / Grease", kod: "20_S5_G1_Grease_DB20", stav: "active" }
          ]
        },
        { id: "1_S030", nazev: "Stanice ST030", stav: "active", casZmeny: new Date() },
        { id: "1_S040", nazev: "Stanice ST040", stav: "active", casZmeny: new Date() },
        { id: "1_S050", nazev: "Stanice ST050", stav: "active", casZmeny: new Date() },
        { id: "1_S060", nazev: "Stanice ST060", stav: "active", casZmeny: new Date() },
        { id: "1_S070", nazev: "Stanice ST070", stav: "active", casZmeny: new Date() }
      ]
    },
    {
      id: "2",
      nazev: "EVO 24",
      kod: "SAEFA024",
      oddeleniId: "cat-assembly", 
      casZmeny: new Date(),
      stanice: [
        { id: "2_S1", nazev: "Hlavní proces", stav: "stopped", casZmeny: new Date() }
      ]
    },

    // =========================================
    // 2. ODDĚLENÍ: MACHINING
    // =========================================
    {
      id: "m1",
      nazev: "Emissa 69 / SW 13",
      kod: "EMISSA_69", // Musí se přesně shodovat s ID v SVG mapě!
      oddeleniId: "cat-machining",
      casZmeny: new Date(),
      stanice: [
        { id: "m1_s1", nazev: "Hlavní proces", stav: "paused", casZmeny: new Date() } // ORANŽOVÁ (pozastaveno)
      ]
    },
    {
      id: "m2",
      nazev: "Vigel 23",
      kod: "VIGEL23",
      oddeleniId: "cat-machining",
      casZmeny: new Date(),
      stanice: [
        { id: "m2_s1", nazev: "Obrábění", stav: "active", casZmeny: new Date() } // ZELENÁ (v provozu)
      ]
    },
    {
      id: "m3",
      nazev: "Oxidation 1",
      kod: "OXIDATION1",
      oddeleniId: "cat-machining",
      casZmeny: new Date(),
      stanice: [
        { id: "m3_s1", nazev: "Ohřev", stav: "stopped", casZmeny: new Date() } // ČERVENÁ (porucha)
      ]
    }
  ];

  if (aktivniStaniceId) renderStationDetail();
  else if (aktivniLinkaId) renderDetail();
  else if (aktivniKategorieId) renderLines();
  else renderCategories();
  
  aktualizujBarvyNaMape();
}

nactiLiveData();