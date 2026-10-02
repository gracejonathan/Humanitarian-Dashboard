/*
 * ============================================================
 * GLOBAL HUMANITARIAN CRISIS DASHBOARD
 * ============================================================
 *
 * LIVE DATA
 * ---------
 * HDX Humanitarian API (HAPI)
 *
 * DATASET
 * -------
 * People in Need (PIN)
 *
 * ADDITIONAL DATA
 * ---------------
 * data/religion.json
 * data/crises.json
 *
 * DISPLAY
 * -------
 * - Top 12 countries initially
 * - Load more reveals another 12
 * - Latest PIN reference period per country
 * - Christian population percentage
 * - Curated Christian presence
 * - Crisis start date
 *
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const HDX_HAPI_APP_ID =
  'SHVtYW5pdGFyaWFuIERhc2hib2FyZDpqd2lsc29uQG9wc2FmZWludGwuY29t';

const PIN_ENDPOINT =
  'https://hapi.humdata.org/api/v1/affected-people/humanitarian-needs';

const PAGE_SIZE = 1000;

const INITIAL_DISPLAY_COUNT = 12;

const LOAD_MORE_COUNT = 12;

const REQUEST_TIMEOUT_MS = 30000;

const REFRESH_INTERVAL_MS =
  6 * 60 * 60 * 1000;


/* ============================================================
   APPLICATION STATE
   ============================================================ */

let allPINCountries = [];

let visibleCount =
  INITIAL_DISPLAY_COUNT;

let religionMap =
  new Map();

let crisisMap =
  new Map();

let isLoading =
  false;

let lastSuccessfulFetch =
  null;


/* ============================================================
   DOM HELPER
   ============================================================ */

function $(id) {
  return document.getElementById(id);
}


/* ============================================================
   SAFE HTML
   ============================================================ */

function esc(value) {

  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[character]
    );
}


/* ============================================================
   NUMBER HELPERS
   ============================================================ */

function num(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function fmt(value) {

  const n =
    num(value);

  if (n === null) {
    return '—';
  }

  return new Intl.NumberFormat(
    'en-US'
  ).format(
    Math.round(n)
  );
}


function compact(value) {

  const n =
    num(value);

  if (n === null) {
    return '—';
  }

  if (n >= 1000000000) {
    return (
      (n / 1000000000)
        .toFixed(1)
        .replace(/\.0$/, '') +
      'B'
    );
  }

  if (n >= 1000000) {
    return (
      (n / 1000000)
        .toFixed(1)
        .replace(/\.0$/, '') +
      'M'
    );
  }

  if (n >= 1000) {
    return (
      (n / 1000)
        .toFixed(1)
        .replace(/\.0$/, '') +
      'K'
    );
  }

  return fmt(n);
}


/* ============================================================
   DATE HELPERS
   ============================================================ */

function date(value) {

  if (!value) {
    return '—';
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return String(value);
  }

  return d.toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }
  );
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
  message,
  live = false
) {

  const status =
    $('status');

  const dot =
    $('dot');

  if (status) {
    status.textContent =
      message;
  }

  if (dot) {

    dot.classList.toggle(
      'live',
      live
    );
  }
}


/* ============================================================
   DIAGNOSTIC LOG
   ============================================================ */

function diag(
  message,
  state = 'wait'
) {

  const log =
    $('diagLog');

  if (!log) {
    return;
  }

  const time =
    new Date()
      .toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      );

  const symbol =
    state === 'ok'
      ? '✓'
      : state === 'bad'
        ? '✕'
        : '…';

  const className =
    state === 'ok'
      ? 'ok'
      : state === 'bad'
        ? 'bad'
        : 'wait';

  log.insertAdjacentHTML(
    'beforeend',
    `
      <div class="diagline">
        <span class="diagtime">
          ${esc(time)}
        </span>

        <span class="${className}">
          ${symbol}
        </span>

        <span>
          ${esc(message)}
        </span>
      </div>
    `
  );
}


function clearDiag() {

  const log =
    $('diagLog');

  if (log) {
    log.innerHTML =
      '';
  }
}


/* ============================================================
   GENERIC JSON FETCH
   ============================================================ */

async function fetchJSON(
  url,
  timeout = REQUEST_TIMEOUT_MS
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {

    const response =
      await fetch(
        url,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json'
          },

          cache:
            'no-store',

          signal:
            controller.signal
        }
      );

    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    return await response.json();

  } catch (error) {

    if (
      error.name ===
      'AbortError'
    ) {

      throw new Error(
        'Request timed out'
      );
    }

    throw error;

  } finally {

    clearTimeout(
      timer
    );
  }
}


/* ============================================================
   HAPI URL
   ============================================================ */

function buildPINUrl(
  offset = 0
) {

  const url =
    new URL(
      PIN_ENDPOINT
    );

  url.searchParams.set(
    'output_format',
    'json'
  );

  url.searchParams.set(
    'app_identifier',
    HDX_HAPI_APP_ID
  );

  url.searchParams.set(
    'sector_name',
    'Intersectoral'
  );

  url.searchParams.set(
    'population_status',
    'INN'
  );

  url.searchParams.set(
    'admin_level',
    '0'
  );

  url.searchParams.set(
    'category',
    ''
  );

  url.searchParams.set(
    'offset',
    String(offset)
  );

  url.searchParams.set(
    'limit',
    String(PAGE_SIZE)
  );

  return url;
}


/* ============================================================
   FETCH ALL HAPI PIN DATA
   ============================================================ */

async function fetchAllPIN() {

  const records =
    [];

  for (
    let offset = 0;
    ;
    offset += PAGE_SIZE
  ) {

    diag(
      `Requesting records ${offset + 1}–${offset + PAGE_SIZE}`
    );

    const response =
      await fetchJSON(
        buildPINUrl(
          offset
        ).toString()
      );

    if (
      !response ||
      !Array.isArray(
        response.data
      )
    ) {

      throw new Error(
        'HAPI response did not contain a data array.'
      );
    }

    records.push(
      ...response.data
    );

    diag(
      `Received ${response.data.length} records`,
      'ok'
    );

    if (
      response.data.length <
      PAGE_SIZE
    ) {
      break;
    }
  }

  return records;
}


/* ============================================================
   SELECT LATEST TOTAL PIN PER COUNTRY
   ============================================================ */

function latestPIN(
  records
) {

  const countries =
    new Map();

  for (
    const row
    of records
  ) {

    if (
      Number(
        row.admin_level
      ) !== 0
    ) {
      continue;
    }

    if (
      row.sector_name !==
      'Intersectoral'
    ) {
      continue;
    }

    if (
      row.population_status !==
      'INN'
    ) {
      continue;
    }

    /*
     * Exclude demographic subsets.
     * We want the total PIN record.
     */

    if (
      row.category !== ''
    ) {
      continue;
    }

    const iso =
      String(
        row.location_code || ''
      )
        .trim()
        .toUpperCase();

    const population =
      num(
        row.population
      );

    if (
      !iso ||
      population === null
    ) {
      continue;
    }

    const existing =
      countries.get(
        iso
      );

    if (!existing) {

      countries.set(
        iso,
        row
      );

      continue;
    }

    const existingDate =
      new Date(
        existing.reference_period_end ||
        existing.reference_period_start ||
        '1900-01-01'
      );

    const currentDate =
      new Date(
        row.reference_period_end ||
        row.reference_period_start ||
        '1900-01-01'
      );

    if (
      currentDate >
      existingDate
    ) {

      countries.set(
        iso,
        row
      );
    }
  }

  return [
    ...countries.values()
  ].sort(
    (a, b) =>
      num(b.population) -
      num(a.population)
  );
}


/* ============================================================
   LOAD RELIGION DATA
   ============================================================ */

async function loadReligion() {

  try {

    const data =
      await fetchJSON(
        'data/religion.json',
        10000
      );

    let rows = [];

    if (
      Array.isArray(data)
    ) {

      rows =
        data;

    } else if (
      Array.isArray(
        data?.countries
      )
    ) {

      rows =
        data.countries;
    }

    religionMap =
      new Map(
        rows
          .filter(
            row =>
              row &&
              row.iso3
          )
          .map(
            row => [
              String(
                row.iso3
              )
                .toUpperCase(),
              row
            ]
          )
      );

    diag(
      `World Religion Database: ${religionMap.size} country records loaded`,
      'ok'
    );

  } catch (error) {

    /*
     * Religion data is supplementary.
     * Do NOT allow it to break the live HAPI dashboard.
     */

    religionMap =
      new Map();

    diag(
      `Christian population data unavailable: ${error.message}`,
      'bad'
    );
  }
}


/* ============================================================
   LOAD CURATED CRISIS DATA
   ============================================================ */

async function loadCrisisData() {

  try {

    const data =
      await fetchJSON(
        'data/crises.json',
        10000
      );

    let rows = [];

    if (
      Array.isArray(data)
    ) {

      rows =
        data;

    } else if (
      Array.isArray(
        data?.crises
      )
    ) {

      rows =
        data.crises;
    }

    crisisMap =
      new Map(
        rows
          .filter(
            row =>
              row &&
              row.iso3
          )
          .map(
            row => [
              String(
                row.iso3
              )
                .toUpperCase(),
              row
            ]
          )
      );

    diag(
      `Curated crisis layer: ${crisisMap.size} country records loaded`,
      'ok'
    );

  } catch (error) {

    crisisMap =
      new Map();

    diag(
      'Curated crisis layer not loaded; countries without local metadata will show "Not yet assessed".',
      'wait'
    );
  }
}


/* ============================================================
   MERGE DATASETS
   ============================================================ */

function mergedRow(
  row
) {

  const iso =
    String(
      row.location_code
    )
      .toUpperCase();

  const religion =
    religionMap.get(
      iso
    ) || {};

  const crisis =
    crisisMap.get(
      iso
    ) || {};

  return {
    ...row,

    ...crisis,

    iso3:
      iso,

    location_name:
      row.location_name ||
      crisis.name ||
      religion.name ||
      iso,

    christianPopulationPercent:
      num(
        religion.christianPopulationPercent
      ),

    religionSource:
      religion.source ||
      'World Religion Database',

    religionYear:
      religion.year ||
      null
  };
}


/* ============================================================
   COUNTRY CARD
   ============================================================ */

function createCard(
  row,
  rank
) {

  const pct =
    row.christianPopulationPercent === null
      ? 'Not available'
      : `${row.christianPopulationPercent}%`;

  const christianPresence =
    row.christianLabel ||
    row.christianPresence ||
    row.christian ||
    'Not yet assessed';

  const crisisStart =
    row.started
      ? date(row.started)
      : 'Not yet documented';

  const referencePeriod =
    `${date(row.reference_period_start)} – ${date(row.reference_period_end)}`;

  const apiUrl =
    buildPINUrl(0);

  apiUrl.searchParams.set(
    'location_code',
    row.iso3
  );

  apiUrl.searchParams.delete(
    'offset'
  );

  apiUrl.searchParams.delete(
    'limit'
  );

  return `
    <article class="card">

      <div class="rank">
        ${rank}
      </div>

      <div class="head">

        <div>

          <h2>
            ${esc(row.location_name)}
          </h2>

          <div class="iso">
            ${esc(row.iso3)}
          </div>

        </div>

        <span class="tag">
          Live PIN
        </span>

      </div>

      <div class="need">
        ${compact(row.population)}
      </div>

      <div class="muted">
        people in need
      </div>

      <div class="exact">
        ${fmt(row.population)}
      </div>

      <div class="meta">

        <div class="muted">
          PIN reference period

          <strong>
            ${esc(referencePeriod)}
          </strong>
        </div>

        <div class="muted">
          Crisis began

          <strong>
            ${esc(crisisStart)}
          </strong>
        </div>

        <div class="muted">
          Christian population

          <strong class="christian">
            ${esc(pct)}
          </strong>
        </div>

        <div class="muted">
          Christian presence

          <strong class="christian">
            ${esc(christianPresence)}
          </strong>
        </div>

      </div>

      <div class="source-note">

        ${esc(row.religionSource)}

        ${
          row.religionYear
            ? ` · ${esc(row.religionYear)}`
            : ''
        }

        · demographic estimate

      </div>

      <div class="sources">

        <a
          href="${apiUrl.toString()}"
          target="_blank"
          rel="noopener noreferrer"
        >
          HAPI record ↗
        </a>

        <a
          href="https://reliefweb.int/country/${row.iso3.toLowerCase()}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ReliefWeb ↗
        </a>

        <button
          onclick="openDetail('${esc(row.iso3)}')"
        >
          Details
        </button>

      </div>

    </article>
  `;
}


/* ============================================================
   FILTER + SORT + RENDER
   ============================================================ */

function render() {

  const search =
    $('search');

  const christian =
    $('christian');

  const sort =
    $('sort');

  const query =
    search
      ? search.value
          .trim()
          .toLowerCase()
      : '';

  const christianFilter =
    christian
      ? christian.value
      : '';

  const sortValue =
    sort
      ? sort.value
      : 'need';


  let rows =
    allPINCountries.filter(
      row => {

        const haystack =
          `
            ${row.location_name}
            ${row.iso3}
            ${row.type || ''}
          `
            .toLowerCase();

        const presence =
          String(
            row.christianPresence ||
            ''
          ).toLowerCase();

        const matchesSearch =
          haystack.includes(
            query
          );

        let matchesChristian =
          true;

        if (
          christianFilter ===
          'documented'
        ) {

          matchesChristian =
            presence ===
            'documented';

        } else if (
          christianFilter ===
          'limited'
        ) {

          matchesChristian =
            presence ===
            'limited';
        }

        return (
          matchesSearch &&
          matchesChristian
        );
      }
    );


  /*
   * Sorting
   */

  rows.sort(
    (a, b) => {

      if (
        sortValue ===
        'name'
      ) {

        return String(
          a.location_name
        ).localeCompare(
          String(
            b.location_name
          )
        );
      }

      if (
        sortValue ===
        'start'
      ) {

        return (
          new Date(
            a.started ||
            '9999-12-31'
          ) -
          new Date(
            b.started ||
            '9999-12-31'
          )
        );
      }

      return (
        num(b.population) -
        num(a.population)
      );
    }
  );


  const visible =
    rows.slice(
      0,
      visibleCount
    );


  const grid =
    $('grid');


  if (grid) {

    grid.innerHTML =
      visible.length
        ? visible
            .map(
              (row, index) =>
                createCard(
                  row,
                  index + 1
                )
            )
            .join('')

        : `
          <div class="empty">

            <h2>
              No countries match.
            </h2>

            <p>
              Try a different search or filter.
            </p>

          </div>
        `;
  }


  /*
   * Load more
   */

  const remaining =
    rows.length -
    visibleCount;

  const loadMore =
    $('loadMore');

  if (loadMore) {

    loadMore.style.display =
      remaining > 0
        ? 'inline-flex'
        : 'none';

    if (
      remaining > 0
    ) {

      loadMore.textContent =
        `Load more · ${
          Math.min(
            LOAD_MORE_COUNT,
            remaining
          )
        } more countries`;
    }
  }


  /*
   * Showing count
   */

  const showing =
    $('showing');

  if (showing) {

    if (
      query ||
      christianFilter
    ) {

      showing.textContent =
        `Showing ${
          visible.length
        } of ${
          rows.length
        } matching countries`;

    } else {

      showing.textContent =
        `Showing ${
          visible.length
        } of ${
          allPINCountries.length
        } countries`;
    }
  }
}


/* ============================================================
   SUMMARY
   ============================================================ */

function updateSummary() {

  const total =
    allPINCountries.reduce(
      (sum, row) =>
        sum +
        (
          num(row.population) ||
          0
        ),
      0
    );


  $('total').textContent =
    compact(total);

  $('recordCount').textContent =
    allPINCountries.length;

  $('liveCount').textContent =
    allPINCountries.length;

  $('refresh').textContent =
    lastSuccessfulFetch
      ? lastSuccessfulFetch
          .toLocaleString()
      : '—';
}


/* ============================================================
   DETAIL VIEW
   ============================================================ */

function openDetail(
  iso
) {

  const row =
    allPINCountries.find(
      item =>
        item.iso3 ===
        iso
    );

  if (!row) {
    return;
  }


  const pct =
    row.christianPopulationPercent === null
      ? 'Not available'
      : `${row.christianPopulationPercent}%`;


  const christianPresence =
    row.christianLabel ||
    row.christianPresence ||
    row.christian ||
    'Not yet assessed';


  const detail =
    $('detail');


  const body =
    $('detailBody');


  body.innerHTML = `

    <div class="eyebrow">
      ${esc(
        row.type ||
        'Humanitarian situation'
      )}
    </div>

    <h2>
      ${esc(row.location_name)}
    </h2>

    <div class="need">
      ${compact(row.population)}
    </div>

    <div class="muted">
      people in need
    </div>

    <div class="detail-grid">

      <div>

        PIN reference period

        <strong>
          ${esc(
            date(
              row.reference_period_start
            )
          )}

          –

          ${esc(
            date(
              row.reference_period_end
            )
          )}
        </strong>

      </div>

      <div>

        Crisis began

        <strong>
          ${esc(
            row.started
              ? date(row.started)
              : 'Not yet documented'
          )}
        </strong>

      </div>

      <div>

        Christian population

        <strong class="christian">
          ${esc(pct)}
        </strong>

        <small>
          World Religion Database,
          ${esc(row.religionYear || '2025')}
        </small>

      </div>

      <div>

        Christian presence

        <strong class="christian">
          ${esc(christianPresence)}
        </strong>

        <small>
          This is a separate curated assessment;
          it is not derived from the demographic percentage.
        </small>

      </div>

    </div>

    <p class="notice">

      <strong>
        Important:
      </strong>

      The Christian population percentage describes
      the estimated share of the country's population
      identified as Christian. It should not be interpreted
      as church capacity, humanitarian response capacity,
      organizational presence, or access.

    </p>

    <div class="sources">

      <a
        href="https://www.thearda.com/world-religion/np-sort?var=ADH_415"
        target="_blank"
        rel="noopener noreferrer"
      >
        World Religion Database ↗
      </a>

      <a
        href="https://reliefweb.int/country/${row.iso3.toLowerCase()}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ReliefWeb ↗
      </a>

    </div>
  `;


  detail.style.display =
    'block';
}


function closeDetail() {

  $('detail').style.display =
    'none';
}


/* ============================================================
   FULL DASHBOARD REFRESH
   ============================================================ */

async function refreshDashboard() {

  if (isLoading) {
    return;
  }

  isLoading =
    true;

  clearDiag();

  setStatus(
    'Connecting to HDX HAPI…',
    false
  );

  diag(
    'GLOBAL HAPI PIN REFRESH'
  );

  diag(
    'Endpoint: humanitarian-needs'
  );

  diag(
    'Filters: Intersectoral / INN / admin level 0'
  );


  try {

    /*
     * Load supplementary datasets.
     *
     * Neither one is allowed to prevent HAPI
     * from loading successfully.
     */

    await Promise.all([
      loadReligion(),
      loadCrisisData()
    ]);


    /*
     * Load live humanitarian data.
     */

    const records =
      await fetchAllPIN();


    diag(
      `Global HAPI dataset: ${records.length} records`,
      'ok'
    );


    /*
     * Select one current total PIN record
     * per country.
     */

    allPINCountries =
      latestPIN(
        records
      )
        .map(
          mergedRow
        );


    if (
      allPINCountries.length === 0
    ) {

      throw new Error(
        'No country-level total PIN records matched the filters.'
      );
    }


    visibleCount =
      INITIAL_DISPLAY_COUNT;

    lastSuccessfulFetch =
      new Date();


    updateSummary();

    render();


    setStatus(
      `LIVE · HAPI · ${allPINCountries.length} countries`,
      true
    );


    diag(
      `Selected ${allPINCountries.length} countries`,
      'ok'
    );


    diag(
      `Largest PIN: ${
        allPINCountries[0]
          .location_name
      } · ${
        fmt(
          allPINCountries[0]
            .population
        )
      }`,
      'ok'
    );


    diag(
      'Global PIN dashboard successfully refreshed',
      'ok'
    );


  } catch (error) {

    console.error(
      'Dashboard refresh failed:',
      error
    );


    setStatus(
      'HAPI unavailable · live PIN data unavailable',
      false
    );


    diag(
      `ERROR: ${error.message}`,
      'bad'
    );


    $('grid').innerHTML = `

      <div class="empty">

        <h2>
          Live humanitarian data unavailable
        </h2>

        <p>
          ${esc(error.message)}
        </p>

        <p>
          Check the live connection log above
          and try again.
        </p>

      </div>
    `;

  } finally {

    isLoading =
      false;
  }
}


/* ============================================================
   EVENT HANDLERS
   ============================================================ */

$('loadMore')
  .addEventListener(
    'click',
    () => {

      visibleCount +=
        LOAD_MORE_COUNT;

      render();
    }
  );


$('search')
  .addEventListener(
    'input',
    () => {

      visibleCount =
        INITIAL_DISPLAY_COUNT;

      render();
    }
  );


$('christian')
  .addEventListener(
    'change',
    () => {

      visibleCount =
        INITIAL_DISPLAY_COUNT;

      render();
    }
  );


$('sort')
  .addEventListener(
    'change',
    () => {

      visibleCount =
        INITIAL_DISPLAY_COUNT;

      render();
    }
  );


$('refreshButton')
  .addEventListener(
    'click',
    refreshDashboard
  );


$('closeDetail')
  .addEventListener(
    'click',
    closeDetail
  );


$('detail')
  .addEventListener(
    'click',
    event => {

      if (
        event.target.id ===
        'detail'
      ) {

        closeDetail();
      }
    }
  );


/* ============================================================
   GLOBAL FUNCTIONS
   ============================================================ */

window.openDetail =
  openDetail;

window.closeDetail =
  closeDetail;

window.refreshDashboard =
  refreshDashboard;


/* ============================================================
   INITIAL LOAD
   ============================================================ */

setStatus(
  'Connecting to HDX HAPI…',
  false
);

diag(
  'Dashboard initialized',
  'ok'
);

diag(
  'HAPI app identifier configured',
  HDX_HAPI_APP_ID
    ? 'ok'
    : 'bad'
);


/*
 * Initial live refresh.
 */

refreshDashboard();


/*
 * Refresh every six hours.
 */

setInterval(
  refreshDashboard,
  REFRESH_INTERVAL_MS
);
