const FALLBACK_CRISIS_SEED = [
  { id: "sudan", name: "Sudan", iso3: "SDN", region: "East Africa", type: "Conflict / displacement", started: "2023-04-15", christianPresence: "documented", christianLabel: "Documented minority presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/sdn"], ["HDX", "https://data.humdata.org/country/sdn"]] },
  { id: "afghanistan", name: "Afghanistan", iso3: "AFG", region: "South Asia", type: "Protracted crisis", started: "1978-04-27", christianPresence: "limited", christianLabel: "Small / limited presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/afg"], ["HDX", "https://data.humdata.org/country/afg"]] },
  { id: "syria", name: "Syria", iso3: "SYR", region: "Middle East", type: "Conflict / displacement", started: "2011-03-15", christianPresence: "documented", christianLabel: "Documented minority presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/syr"], ["HDX", "https://data.humdata.org/country/syr"]] },
  { id: "drc", name: "Democratic Republic of the Congo", iso3: "COD", region: "Central Africa", type: "Conflict / displacement", started: "1996-10-24", christianPresence: "documented", christianLabel: "Large Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/cod"], ["HDX", "https://data.humdata.org/country/cod"]] },
  { id: "ukraine", name: "Ukraine", iso3: "UKR", region: "Europe", type: "International armed conflict", started: "2022-02-24", christianPresence: "documented", christianLabel: "Established Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/ukr"], ["HDX", "https://data.humdata.org/country/ukr"]] },
  { id: "yemen", name: "Yemen", iso3: "YEM", region: "Middle East", type: "Conflict / food insecurity", started: "2014-09-21", christianPresence: "limited", christianLabel: "Very small / restricted presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/yem"], ["HDX", "https://data.humdata.org/country/yem"]] },
  { id: "palestine", name: "Occupied Palestinian Territory", iso3: "PSE", region: "Middle East", type: "Conflict / humanitarian emergency", started: "2023-10-07", christianPresence: "documented", christianLabel: "Documented Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/pse"], ["HDX", "https://data.humdata.org/country/pse"]] },
  { id: "myanmar", name: "Myanmar", iso3: "MMR", region: "Southeast Asia", type: "Conflict / displacement", started: "2021-02-01", christianPresence: "documented", christianLabel: "Documented Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/mmr"], ["HDX", "https://data.humdata.org/country/mmr"]] },
  { id: "somalia", name: "Somalia", iso3: "SOM", region: "Horn of Africa", type: "Drought / displacement / conflict", started: "2011-01-01", christianPresence: "documented", christianLabel: "Small documented community", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/som"], ["HDX", "https://data.humdata.org/country/som"]] },
  { id: "ethiopia", name: "Ethiopia", iso3: "ETH", region: "East Africa", type: "Conflict / drought / displacement", started: "2020-11-01", christianPresence: "documented", christianLabel: "Large Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/eth"], ["HDX", "https://data.humdata.org/country/eth"]] },
  { id: "nigeria", name: "Nigeria", iso3: "NGA", region: "West Africa", type: "Conflict / displacement", started: "2009-01-01", christianPresence: "documented", christianLabel: "Large Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/nga"], ["HDX", "https://data.humdata.org/country/nga"]] },
  { id: "haiti", name: "Haiti", iso3: "HTI", region: "Caribbean", type: "Complex emergency / insecurity", started: "2020-01-01", christianPresence: "documented", christianLabel: "Large Christian presence", christianEvidence: "Curated country-level evidence; requires periodic verification", sourceLinks: [["ReliefWeb", "https://reliefweb.int/country/hti"], ["HDX", "https://data.humdata.org/country/hti"]] }
];

const DEFAULT_CHRISTIAN_PERCENTAGES = {
  AFG: 0.3,
  COD: 95.0,
  ETH: 62.8,
  HTI: 80.0,
  MMR: 6.2,
  NGA: 46.8,
  PSE: 1.8,
  SDN: 5.2,
  SOM: 3.0,
  SYR: 10.0,
  UKR: 77.0,
  YEM: 1.0
};

const state = {
  crises: [],
  rows: [],
  rowById: new Map(),
  liveCount: 0,
  dataSource: "unknown",
  lastFetch: null,
  christianPercentByIso3: { ...DEFAULT_CHRISTIAN_PERCENTAGES }
};

const $ = id => document.getElementById(id);
const fmt = n => n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n));
const compact = n => {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return fmt(n);
};
const dateFormatter = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
};
const esc = s => String(s ?? "").replace(/[&<>\"']/g, m => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[m]));

function log(message, type = "wait") {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const icon = type === "ok" ? "✓" : type === "bad" ? "✕" : "…";
  const div = document.createElement("div");
  div.className = `log-line log-${type}`;
  div.textContent = `[${now}] ${icon} ${message}`;
  $("connectionLog").appendChild(div);
  $("connectionLog").scrollTop = $("connectionLog").scrollHeight;
}

function status(text, type = "wait") {
  $("connectionStatus").textContent = text;
  $("connectionStatus").className = `status status-${type}`;
}

function normalizeIso3(value) {
  return String(value ?? "").trim().toUpperCase();
}

async function loadChristianPercentages() {
  const fallback = { ...DEFAULT_CHRISTIAN_PERCENTAGES };
  try {
    const response = await fetch("data/christian-percentages.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload?.countries || payload?.data || payload?.records || [];
    const map = { ...fallback };

    for (const item of items) {
      const iso3 = normalizeIso3(item?.iso3 || item?.country_iso3 || item?.country?.iso3 || item?.code || item?.countryCode || "");
      if (!iso3) continue;
      const value = Number(item?.christian_percent ?? item?.christianPercent ?? item?.percent ?? item?.value ?? item?.estimate ?? item?.percentage);
      if (Number.isFinite(value) && value >= 0 && value <= 100) {
        map[iso3] = value;
      }
    }

    log(`Christian share dataset loaded with ${Object.keys(map).length} country estimates`, "ok");
    return map;
  } catch (error) {
    log(`Christian percentage dataset unavailable; using versioned fallback estimates`, "bad");
    return fallback;
  }
}

async function loadCrisesFromFile() {
  try {
    log("Loading crisis data from data/crises.json");
    const response = await fetch("data/crises.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    
    if (!json || !json.crises || !Array.isArray(json.crises)) {
      log("Crisis data file has invalid structure", "bad");
      return null;
    }

    log(`Loaded ${json.crises.length} crises from data/crises.json`, "ok");
    state.lastFetch = json.timestamp || new Date().toISOString();
    state.dataSource = "local";
    return json.crises;
  } catch (error) {
    log(`Failed to load crisis data from file: ${error.message}`, "bad");
    return null;
  }
}

function render() {
  const q = $("search").value.toLowerCase();
  const p = $("presence").value;
  const sort = $("sort").value;

  let rows = state.rows.filter(r => {
    const matchesText = `${r.name} ${r.region} ${r.type}`.toLowerCase().includes(q);
    const matchesPresence = !p || r.christianPresence === p;
    return matchesText && matchesPresence;
  });

  rows.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "start") return new Date(a.started) - new Date(b.started);
    return (b.peopleInNeed ?? -1) - (a.peopleInNeed ?? -1);
  });

  const total = state.rows.reduce((sum, r) => sum + (r.peopleInNeed || 0), 0);
  $("totalNeed").textContent = total ? compact(total) : "—";
  $("recordCount").textContent = state.rows.length;
  $("liveCount").textContent = state.liveCount;

  $("crisisGrid").innerHTML = rows.length ? rows.map(r => `
    <article class="card">
      <div class="card-head">
        <div>
          <h3>${esc(r.name)}</h3>
          <span class="tag">${esc(r.type)}</span>
        </div>
        <span class="tag">${r.live ? "LIVE" : "SOURCE-BACKED"}</span>
      </div>
      <div class="need">${compact(r.peopleInNeed)}</div>
      <div class="muted">${r.peopleInNeed != null ? "people in humanitarian need" : "current PIN unavailable"}</div>
      <div class="meta">
        <div class="muted">Crisis began <strong>${formatDate(r.started)}</strong></div>
        <div class="muted">Humanitarian source <strong>${esc(r.source || "ReliefWeb")}</strong></div>
        <div class="muted">Christian presence <strong class="christian">${esc(r.christianLabel)}${r.christianPercent != null ? ` · ${r.christianPercent.toFixed(1)}% Christian share` : ""}</strong></div>
        <div class="muted">Evidence <strong>${esc(r.christianEvidence)}</strong></div>
      </div>
      <div class="sources">
        ${r.sourceLinks.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${esc(s[0])} ↗</a>`).join("")}
      </div>
    </article>
  `).join("") : "<p>No matching crises.</p>";
}

async function refresh() {
  $("connectionLog").innerHTML = "";
  status("Loading global crisis watchlist…", "wait");
  log("Dashboard JavaScript is running", "ok");

  state.christianPercentByIso3 = await loadChristianPercentages();

  // Load crisis data from local data/crises.json file (generated by GitHub Actions).
  // This eliminates CORS issues entirely — no browser-to-API calls needed.
  const crises = await loadCrisesFromFile();
  
  if (!crises || crises.length === 0) {
    log("Using curated fallback crisis seed", "bad");
    state.crises = FALLBACK_CRISIS_SEED;
    state.dataSource = "fallback";
  } else {
    state.crises = crises;
  }

  state.rows = state.crises.map(row => ({
    ...row,
    peopleInNeed: row.peopleInNeed ?? null,
    live: state.dataSource === "local" && !FALLBACK_CRISIS_SEED.some(seed => seed.id === row.id),
    source: state.dataSource === "local" ? "ReliefWeb API (via GitHub Actions)" : "Curated fallback",
    christianPercent: state.christianPercentByIso3[normalizeIso3(row.iso3)] ?? null,
    christianLabel: row.christianPercent != null ? "Documented Christian presence (estimated share)" : row.christianLabel || "Documented Christian presence"
  }));
  state.rowById = new Map(state.rows.map(row => [row.id, row]));
  state.liveCount = state.rows.filter(row => row.live).length;
  render();
  log(`Global crisis watchlist loaded: ${state.crises.length} crisis records`, "ok");

  $("lastRefresh").textContent = state.lastFetch ? formatDate(state.lastFetch) : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (state.dataSource === "local" && state.liveCount > 0) {
    status(`ReliefWeb data loaded (via GitHub Actions) · ${state.liveCount} live crisis record(s)`, "ok");
    log(`Refresh complete: ${state.liveCount} live crisis record(s) from ReliefWeb`, "ok");
  } else if (state.dataSource === "local") {
    status(`Data loaded from local source · using curated fallback records`, "wait");
    log("Refresh complete: local data/crises.json loaded but all records are fallback.", "wait");
  } else {
    status("Using curated fallback crisis records", "bad");
    log("Refresh complete: using curated fallback (data/crises.json unavailable).", "bad");
  }
}

$("refreshBtn").addEventListener("click", refresh);
["search", "presence", "sort"].forEach(id => $(id).addEventListener("input", () => render()));
refresh();
// Re-check for updates every 6 hours
setInterval(refresh, 6 * 60 * 60 * 1000);
