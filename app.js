const state = {
  crises: [],
  rows: [],
  rowById: new Map(),
  discoveredPlans: {},
  liveCount: 0
};

const GLOBAL_CRISIS_SEED = [
  {
    id: "sudan",
    name: "Sudan",
    iso3: "SDN",
    region: "East Africa",
    type: "Conflict / displacement",
    started: "2023-04-15",
    christianPresence: "documented",
    christianLabel: "Documented minority presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/sdn"],
      ["HDX", "https://data.humdata.org/country/sdn"]
    ]
  },
  {
    id: "palestine",
    name: "Occupied Palestinian Territory",
    iso3: "PSE",
    region: "Middle East",
    type: "Conflict / humanitarian emergency",
    started: "2023-10-07",
    christianPresence: "documented",
    christianLabel: "Documented Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/pse"],
      ["HDX", "https://data.humdata.org/country/pse"]
    ]
  },
  {
    id: "ukraine",
    name: "Ukraine",
    iso3: "UKR",
    region: "Europe",
    type: "International armed conflict",
    started: "2022-02-24",
    christianPresence: "documented",
    christianLabel: "Established Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/ukr"],
      ["HDX", "https://data.humdata.org/country/ukr"]
    ]
  },
  {
    id: "syria",
    name: "Syria",
    iso3: "SYR",
    region: "Middle East",
    type: "Conflict / displacement",
    started: "2011-03-15",
    christianPresence: "documented",
    christianLabel: "Documented minority presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/syr"],
      ["HDX", "https://data.humdata.org/country/syr"]
    ]
  },
  {
    id: "drc",
    name: "Democratic Republic of the Congo",
    iso3: "COD",
    region: "Central Africa",
    type: "Conflict / displacement",
    started: "1996-10-24",
    christianPresence: "documented",
    christianLabel: "Large Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/cod"],
      ["HDX", "https://data.humdata.org/country/cod"]
    ]
  },
  {
    id: "yemen",
    name: "Yemen",
    iso3: "YEM",
    region: "Middle East",
    type: "Conflict / food insecurity",
    started: "2014-09-21",
    christianPresence: "limited",
    christianLabel: "Very small / restricted presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/yem"],
      ["HDX", "https://data.humdata.org/country/yem"]
    ]
  },
  {
    id: "afghanistan",
    name: "Afghanistan",
    iso3: "AFG",
    region: "South Asia",
    type: "Protracted crisis",
    started: "1978-04-27",
    christianPresence: "limited",
    christianLabel: "Small / limited presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/afg"],
      ["HDX", "https://data.humdata.org/country/afg"]
    ]
  },
  {
    id: "myanmar",
    name: "Myanmar",
    iso3: "MMR",
    region: "Southeast Asia",
    type: "Conflict / displacement",
    started: "2021-02-01",
    christianPresence: "documented",
    christianLabel: "Documented Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/mmr"],
      ["HDX", "https://data.humdata.org/country/mmr"]
    ]
  },
  {
    id: "somalia",
    name: "Somalia",
    iso3: "SOM",
    region: "Horn of Africa",
    type: "Drought / displacement / conflict",
    started: "2011-01-01",
    christianPresence: "documented",
    christianLabel: "Small documented community",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/som"],
      ["HDX", "https://data.humdata.org/country/som"]
    ]
  },
  {
    id: "ethiopia",
    name: "Ethiopia",
    iso3: "ETH",
    region: "East Africa",
    type: "Conflict / drought / displacement",
    started: "2020-11-01",
    christianPresence: "documented",
    christianLabel: "Large Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/eth"],
      ["HDX", "https://data.humdata.org/country/eth"]
    ]
  },
  {
    id: "nigeria",
    name: "Nigeria",
    iso3: "NGA",
    region: "West Africa",
    type: "Conflict / displacement",
    started: "2009-01-01",
    christianPresence: "documented",
    christianLabel: "Large Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/nga"],
      ["HDX", "https://data.humdata.org/country/nga"]
    ]
  },
  {
    id: "haiti",
    name: "Haiti",
    iso3: "HTI",
    region: "Caribbean",
    type: "Complex emergency / insecurity",
    started: "2020-01-01",
    christianPresence: "documented",
    christianLabel: "Large Christian presence",
    christianEvidence: "Curated country-level evidence; requires periodic verification",
    sourceLinks: [
      ["ReliefWeb", "https://reliefweb.int/country/hti"],
      ["HDX", "https://data.humdata.org/country/hti"]
    ]
  }
];

const $ = id => document.getElementById(id);
const fmt = n => n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n));
const compact = n => {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return fmt(n);
};
const dateFormatter = new Intl.DateTimeFormat(undefined, {year:"numeric", month:"short", day:"numeric"});
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
};
const esc = s => String(s ?? "").replace(/[&<>\"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[m]));

const debounce = (fn, wait = 200) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), wait);
  };
};

function log(message, type = "wait") {
  const now = new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});
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

async function getJSON(url, label) {
  log(`Connecting to ${label}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {headers:{Accept:"application/json"}, cache:"no-store", signal:controller.signal});
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const json = await response.json();
    log(`${label} responded successfully`, "ok");
    return json;
  } catch (e) {
    log(`${label} failed: ${e.name === "AbortError" ? "10-second timeout" : e.message}`, "bad");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractPlans(json) {
  const raw = Array.isArray(json) ? json : (json?.data || json?.plans || json?.results || []);
  const plans = Array.isArray(raw) ? raw : [];
  const map = {};

  for (const p of plans) {
    const id = p?.id || p?.planId || p?.plan_id;
    if (!id) continue;

    const isoCandidates = [
      p?.iso3,
      p?.country?.iso3,
      p?.country?.iso3Code,
      p?.countryCode,
      p?.country?.code,
      p?.operation?.iso3,
      p?.locations?.[0]?.iso3,
      p?.locations?.[0]?.refCode,
      p?.locations?.[0]?.code,
      p?.locations?.[0]?.pcode,
      p?.planVersion?.location?.iso3,
      p?.planVersion?.country?.iso3
    ].filter(Boolean);

    const iso = String(isoCandidates[0] || "").toUpperCase();
    if (iso) map[iso] = id;
  }

  return map;
}

function extractPIN(json) {
  const attachments = json?.data?.attachments || [];
  const candidates = [];
  for (const a of attachments) {
    if (a?.type !== "caseLoad") continue;
    const value = a?.attachmentVersion?.value;
    const totals = value?.metrics?.values?.totals || [];
    const pin = totals.find(x => x?.type === "inNeed");
    if (pin?.value != null) candidates.push({
      value: Number(pin.value),
      description: value?.description || ""
    });
  }
  candidates.sort((a,b) => b.value - a.value);
  return candidates[0] || null;
}

async function discoverOchaPlans() {
  const endpoints = [
    "https://api.hpc.tools/v2/public/plan",
    "https://api.hpc.tools/v2/public/plan?status=active"
  ];
  for (const url of endpoints) {
    const json = await getJSON(url, "OCHA Humanitarian Programme Cycle plan API");
    if (!json) continue;
    const plans = extractPlans(json);
    log(`OCHA returned ${Object.keys(plans).length} usable country-plan mappings`, Object.keys(plans).length ? "ok" : "bad");
    if (Object.keys(plans).length) return plans;
  }
  return {};
}

async function getOchaPIN(crisis, planId) {
  const url = `https://api.hpc.tools/v2/public/plan/${encodeURIComponent(planId)}?content=entities&disaggregation=false`;
  const json = await getJSON(url, `OCHA current PIN data · ${crisis.name} · plan ${planId}`);
  if (!json) return null;
  const pin = extractPIN(json);
  if (pin) {
    log(`${crisis.name}: ${fmt(pin.value)} people in need returned by OCHA`, "ok");
  } else {
    log(`${crisis.name}: OCHA responded but no overall PIN was found`, "bad");
  }
  return pin;
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

  rows.sort((a,b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "start") return new Date(a.started) - new Date(b.started);
    return (b.peopleInNeed ?? -1) - (a.peopleInNeed ?? -1);
  });

  const total = state.rows.reduce((s,r) => s + (r.peopleInNeed || 0), 0);
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
        <div class="muted">Crisis began
          <strong>${formatDate(r.started)}</strong>
        </div>
        <div class="muted">Humanitarian source
          <strong>${esc(r.source || "Not available")}</strong>
        </div>
        <div class="muted">Christian presence
          <strong class="christian">${esc(r.christianLabel)}</strong>
        </div>
        <div class="muted">Evidence
          <strong>${esc(r.christianEvidence)}</strong>
        </div>
      </div>
      <div class="sources">
        ${r.live && r.planId ? `<a href="https://api.hpc.tools/v2/public/plan/${encodeURIComponent(r.planId)}?content=entities&disaggregation=false" target="_blank" rel="noopener">OCHA API ↗</a>` : ""}
        ${r.sourceLinks.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${esc(s[0])} ↗</a>`).join("")}
      </div>
    </article>
  `).join("") : "<p>No matching crises.</p>";
}

async function refresh() {
  $("connectionLog").innerHTML = "";
  status("Loading global crisis watchlist…", "wait");
  log("Dashboard JavaScript is running", "ok");

  state.crises = GLOBAL_CRISIS_SEED.map(x => ({...x, peopleInNeed:null, live:false}));
  state.rowById = new Map(state.crises.map(row => [row.id, row]));
  render();
  log(`Global crisis watchlist loaded: ${state.crises.length} crisis records`, "ok");

  status("Connecting to OCHA…", "wait");
  state.discoveredPlans = await discoverOchaPlans();

  const liveResults = await Promise.all(
    state.crises.map(async crisis => {
      const planId = state.discoveredPlans[crisis.iso3];
      if (!planId) {
        log(`${crisis.name}: no current OCHA plan discovered; retaining source links`, "wait");
        return null;
      }

      const pin = await getOchaPIN(crisis, planId);
      if (!pin) return null;

      const row = state.rowById.get(crisis.id);
      if (!row) return null;

      row.peopleInNeed = pin.value;
      row.source = `OCHA HPC · ${pin.description || "current plan"}`;
      row.planId = planId;
      row.live = true;
      return crisis.id;
    })
  );

  state.liveCount = liveResults.filter(Boolean).length;
  render();
  $("lastRefresh").textContent = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  if (state.liveCount) {
    status(`Live OCHA connection succeeded · ${state.liveCount} crisis record(s) refreshed`, "ok");
    log(`Refresh complete: ${state.liveCount} live OCHA record(s) loaded`, "ok");
  } else {
    status("OCHA connection did not return usable PIN data for the current global watchlist", "bad");
    log("Refresh complete: no live OCHA PIN values were obtained for the current global watchlist. Source-backed records remain visible.", "bad");
  }
}

const debouncedRender = debounce(render, 200);
$("refreshBtn").addEventListener("click", refresh);
["search","presence","sort"].forEach(id => $(id).addEventListener("input", debouncedRender));
refresh();
setInterval(refresh, 6 * 60 * 60 * 1000);
