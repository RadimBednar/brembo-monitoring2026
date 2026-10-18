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
const viewStationDetail = document.getElementById("view-station-detail");

let aktivniKategorieId = null;
let aktivniLinkaId = null;
let aktivniStaniceId = null;

function renderCategories() {
  const container = document.getElementById("categories-grid");
  if (!container) return;
  
  container.innerHTML = oddeleni.map(odd => {
    const linkyVOddeleni = linky.filter(l => l.oddeleniId === odd.id);
    const pocetLinek = linkyVOddeleni.length;
    
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
  
  const souborMapy = MAPY_ODDELENI[katId];
  if (souborMapy) {
    await nactiMapu(souborMapy);
    aktualizujBarvyNaMape();
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

  // Klasické zobrazení karet - nyní se kliká na Emissa 69 / SW 13
  document.getElementById("stations-grid").innerHTML = linka.stanice.map(stanice => {
    // Karta je klikací, pokud má subprocesy NEBO pokud je to speciální machining grid
    const maSubprocesy = (stanice.subprocesy && stanice.subprocesy.length > 0) || stanice.isMachiningToolGrid;
    const actionAttr = maSubprocesy ? `onclick="otevriStanici('${stanice.id}')"` : '';
    const cursorStyle = maSubprocesy ? 'cursor: pointer;' : 'cursor: default;';
    const hintText = maSubprocesy ? `<div style="margin-top: 12px; font-size: 0.8rem; color: #38bdf8;">Zobrazit detaily →</div>` : '';

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
// LOGIKA PRO DETAIL STANICE (4. ÚROVEŇ)
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
  
  if(!stanice) return;

  document.getElementById("detail-station-title").textContent = `${linka.nazev} - ${stanice.nazev}`;

  // Vlastní komponenty pro tuto stanici rozdělené do sekcí
  if (stanice.isMachiningToolGrid) {
    
    // DEMO DATA 1: Hlavní prvky stroje
    const stroj = [
      { nazev: "Otočný stůl", stav: "active", textStavu: "Aktivní" },
      { nazev: "Dveře stroje", stav: "stopped", textStavu: "Zavřené" }
    ];

    
    // DEMO DATA 2: Magazín nástrojů
    const magazin = [
  { 
    nazev: "Nástroj 1 - Vrták", 
    kod: "ID: T-01", 
    stav: "active", 
    textStavu: "Ve vřeteni", 
    zivotnost: 85, 
    zbyvaCyklu: 1250 
  },
  { 
    nazev: "Nástroj 2 - Vrták", 
    kod: "ID: T-02", 
    stav: "paused", 
    textStavu: "V magazínu", 
    zivotnost: 42, 
    zbyvaCyklu: 600 
  },
  { 
    nazev: "Nástroj 3 - Vrták", 
    kod: "ID: T-03", 
    stav: "stopped", 
    textStavu: "Opotřebený", 
    zivotnost: 5, 
    zbyvaCyklu: 0 
  },
  { 
    nazev: "Nástroj 4 - Vrták", 
    kod: "ID: T-04", 
    stav: "paused", 
    textStavu: "V magazínu", 
    zivotnost: 98, 
    zbyvaCyklu: 2100 
  }
];

    // Funkce pro vygenerování HTML jedné karty
    const vytvorKartu = (k) => {
      let detailHtml = '';
      if (k.zivotnost !== undefined) {
         let barColor = "#10b981"; // Zelená
         if (k.zivotnost < 20) barColor = "#ef4444"; // Červená
         else if (k.zivotnost < 50) barColor = "#f59e0b"; // Oranžová

         detailHtml = `
          <div class="line-details" style="margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px;">
              <span>Životnost nástroje:</span>
              <span style="font-weight: bold; color: ${barColor};">${k.zivotnost} %</span>
            </div>
            <div style="width: 100%; background-color: #334155; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="width: ${k.zivotnost}%; background-color: ${barColor}; height: 100%; transition: width 0.5s;"></div>
            </div>
          </div>
         `;
      }

      return `
        <div class="line-card ${k.stav}-border" style="cursor: default;">
          <div class="line-header">
            <span class="line-name" style="font-size: 1.1rem; font-weight: bold;">${k.nazev}</span>
            <span class="status-badge ${k.stav}">${k.textStavu}</span>
          </div>
          ${detailHtml}
        </div>
      `;
    };

   // Složení celkového HTML se dvěma oddělenými sekcemi a gridem
    document.getElementById("subprocesses-grid").innerHTML = `
      <div style="width: 100%; grid-column: 1 / -1; margin-bottom: 30px;">
        <h2 style="color: #fff; font-size: 1.4rem; font-weight: 600; margin-bottom: 15px; border: none;">Stav stroje</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
          ${stroj.map(vytvorKartu).join("")}
        </div>
      </div>

      <div style="width: 100%; grid-column: 1 / -1;">
        <h2 style="color: #fff; font-size: 1.4rem; font-weight: 600; margin-bottom: 15px; border: none;">Magazín nástrojů</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
          ${magazin.map(vytvorKartu).join("")}
        </div>
      </div>
    `;

  // Pokud je to normální stanice s podprocesy (Assembly)
  } else if (stanice.subprocesy) {
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

document.getElementById("btn-back-to-line-detail")?.addEventListener("click", () => {
  aktivniStaniceId = null;
  viewStationDetail.classList.add("hidden");
  viewDetail.classList.remove("hidden");
});


// ==========================================
// 3. MAPA (SVG) A JEJÍ OBARVOVÁNÍ
// ==========================================
async function nactiMapu(nazevSouboru) {
  try {
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
          subprocesy: [
            { nazev: "Laserové značení", kod: "20_S2_G1_Laser_DB20", stav: "active" },
            { nazev: "Průtokový test", kod: "20_S3G5_TLGB_FLOW20", stav: "active" }
          ]
        }
      ]
    },
    {
      id: "m1",
      nazev: "Emissa 69 / SW 13",
      kod: "EMISSA_69",
      oddeleniId: "cat-machining",
      casZmeny: new Date(),
      stanice: [
        // ZDE JE TO ROZDĚLENÉ NA DVĚ KARTY S PŘÍZNAKEM PRO NÁSTROJE
        { id: "m1_s1", nazev: "Emissa 69", stav: "paused", casZmeny: new Date(), isMachiningToolGrid: true },
        { id: "m1_s2", nazev: "SW 13", stav: "active", casZmeny: new Date(), isMachiningToolGrid: true }
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
