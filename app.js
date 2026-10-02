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

async function getJSON(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    log(`Connecting to ${label}`);
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const json = await response.json();
    log(`${label} responded successfully`, "ok");
    return json;
  } catch (error) {
    log(`${label} failed: ${error.name === "AbortError" ? "10-second timeout" : error.message}`, "bad");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch active crises from ReliefWeb API v2 (CORS-enabled, no proxy needed).
// ReliefWeb v1 API is deprecated (HTTP 410). v2 requires an appname parameter.
async function fetchGlobalCrisisWatchlist() {
  // ReliefWeb API v2 endpoint: GET /v2/disasters with appname parameter.
  // Supports CORS, so browser requests work without a proxy.
  const appname = "humanitarian-dashboard";
  const url = `https://api.reliefweb.int/v2/disasters?appname=${encodeURIComponent(appname)}&limit=50`;
  const json = await getJSON(url, "ReliefWeb API v2 active disasters");
  if (!json || !json.data || !Array.isArray(json.data)) {
    log("ReliefWeb returned no crisis data; using curated fallback list", "bad");
    return FALLBACK_CRISIS_SEED;
  }

  // Extract crises from ReliefWeb response and normalize to our schema.
  const normalized = json.data
    .map(item => {
      const fields = item?.fields || {};
      const name = fields?.name || "Unknown Crisis";
      
      // ReliefWeb v2 provides a primary_country or countries array.
      // Extract ISO3 from the primary country.
      const iso3 = (fields?.primary_country?.iso3 || "").toUpperCase();
      const started = fields?.date?.created || fields?.date?.start || null;
      const type = fields?.type?.[0]?.name || "Humanitarian emergency";
      const region = fields?.primary_country?.region?.name || "Global";

      return {
        id: (iso3 || name).toLowerCase().replace(/\s+/g, "-"),
        iso3: iso3 || "UNK",
        name,
        region,
        type,
        started,
        christianPresence: "documented",
        christianLabel: "ReliefWeb live source",
        christianEvidence: "Live crisis source from ReliefWeb API v2; source-backed until verified",
        sourceLinks: [["ReliefWeb", `https://reliefweb.int/disasters/${item?.id || ""}`], ["ReliefWeb Map", "https://reliefweb.int/map"]]
      };
    })
    .filter(crisis => crisis.iso3 !== "UNK") // Exclude crises with unknown country codes
    .slice(0, 12); // Limit to 12 for consistency with original dashboard

  if (normalized.length === 0) {
    log("ReliefWeb returned crises but none could be normalized; using curated fallback list", "bad");
    return FALLBACK_CRISIS_SEED;
  }

  log(`ReliefWeb API v2 returned ${normalized.length} live crisis record(s)`, "ok");
  return normalized;
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
  status("Loading global crisis watchlist from ReliefWeb…", "wait");
  log("Dashboard JavaScript is running", "ok");

  state.christianPercentByIso3 = await loadChristianPercentages();

  // Fetch the crisis watchlist from ReliefWeb v2 API (CORS-enabled, live data).
  const watchlist = await fetchGlobalCrisisWatchlist();
  state.crises = watchlist;
  state.rows = state.crises.map(row => ({
    ...row,
    peopleInNeed: row.peopleInNeed ?? null,
    live: !FALLBACK_CRISIS_SEED.some(seed => seed.id === row.id), // Mark as live if not from fallback
    source: "ReliefWeb API v2",
    christianPercent: state.christianPercentByIso3[normalizeIso3(row.iso3)] ?? null,
    christianLabel: row.christianPercent != null ? "Documented Christian presence (estimated share)" : row.christianLabel || "Documented Christian presence"
  }));
  state.rowById = new Map(state.rows.map(row => [row.id, row]));
  state.liveCount = state.rows.filter(row => row.live).length;
  render();
  log(`Global crisis watchlist loaded: ${state.crises.length} crisis records`, "ok");

  $("lastRefresh").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (state.liveCount) {
    status(`ReliefWeb connection succeeded · ${state.liveCount} live crisis record(s)`, "ok");
    log(`Refresh complete: ${state.liveCount} live ReliefWeb crisis record(s) loaded`, "ok");
  } else {
    status("ReliefWeb returned curated fallback records", "bad");
    log("Refresh complete: using curated fallback records (ReliefWeb unavailable or returned no ISO3 codes).", "bad");
  }
}

$("refreshBtn").addEventListener("click", refresh);
["search", "presence", "sort"].forEach(id => $(id).addEventListener("input", () => render()));
refresh();
setInterval(refresh, 6 * 60 * 60 * 1000);
