/*
 * ============================================================
 * GLOBAL HUMANITARIAN CRISIS DASHBOARD
 * ============================================================
 *
 * LIVE DATA
 * ----------
 * HDX Humanitarian API (HAPI)
 * People in Need (PIN)
 *
 * CURATED DATA
 * ------------
 * data/crises.json
 *   - crisis type
 *   - crisis start date
 *   - local Christian presence
 *   - Christian-presence evidence
 *   - country source links
 *
 * DEMOGRAPHIC DATA
 * ----------------
 * data/religion.json
 *   - Christian population percentage
 *   - World Religion Database 2025
 *
 * ============================================================
 */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const HDX_HAPI_APP_ID =
  'SHVtYW5pdGFyaWFuIERhc2hib2FyZDpqd2lsc29uQG9wc2FmZWludGwuY29t';

const HAPI_BASE =
  'https://hapi.humdata.org/api/v1';

const PIN_ENDPOINT =
  `${HAPI_BASE}/affected-people/humanitarian-needs`;

const CRISIS_DATA_URL =
  'data/crises.json';

const RELIGION_DATA_URL =
  'data/religion.json';

const PAGE_SIZE =
  1000;

const INITIAL_DISPLAY_COUNT =
  12;

const LOAD_MORE_COUNT =
  12;

const REQUEST_TIMEOUT_MS =
  30000;

const REFRESH_INTERVAL_MS =
  6 * 60 * 60 * 1000;


/* ============================================================
   APPLICATION STATE
   ============================================================ */

let allPINCountries = [];

let visibleCount =
  INITIAL_DISPLAY_COUNT;

let lastSuccessfulFetch =
  null;

let isLoading =
  false;

let crisisData =
  [];

let religionData =
  {};

let currentSearch =
  '';

let currentPresenceFilter =
  '';

let currentSort =
  'need';


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function $(id) {
  return document.getElementById(id);
}


function escapeHtml(value) {

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


function toNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


/* ============================================================
   NUMBER FORMATTING
   ============================================================ */

function formatNumber(value) {

  const number =
    toNumber(value);

  if (number === null)
    return '—';

  return new Intl.NumberFormat(
    'en-US'
  ).format(
    Math.round(number)
  );
}


function formatCompact(value) {

  const number =
    toNumber(value);

  if (number === null)
    return '—';

  if (number >= 1000000000) {

    return (
      (number / 1000000000)
        .toFixed(1)
        .replace(/\.0$/, '') +
      'B'
    );
  }

  if (number >= 1000000) {

    return (
      (number / 1000000)
        .toFixed(1)
        .replace(/\.0$/, '') +
      'M'
    );
  }

  if (number >= 1000) {

    return (
      (number / 1000)
        .toFixed(1)
        .replace(/\.0$/, '') +
      'K'
    );
  }

  return formatNumber(number);
}


function formatPercentage(value) {

  const number =
    toNumber(value);

  if (number === null)
    return 'Not available';

  if (number < 0.1)
    return `${number.toFixed(2)}%`;

  if (number < 1)
    return `${number.toFixed(2)}%`;

  return `${number.toFixed(1)}%`;
}


/* ============================================================
   DATE FORMATTING
   ============================================================ */

function formatDate(value) {

  if (!value)
    return '—';

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }
  );
}


function formatDateRange(
  start,
  end
) {

  if (!start && !end)
    return '—';

  if (
    start &&
    end
  ) {

    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  return formatDate(
    start || end
  );
}


/* ============================================================
   DATA CURRENCY
   ============================================================ */

function getDataCurrency(
  referenceEnd
) {

  if (!referenceEnd)
    return 'Data currency unavailable';

  const date =
    new Date(referenceEnd);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Data currency unavailable';
  }

  const year =
    date.getUTCFullYear();

  if (year >= 2026)
    return '2026 assessment';

  if (year === 2025)
    return '2025 assessment';

  return `${year} assessment`;
}


/* ============================================================
   STATUS / DIAGNOSTICS
   ============================================================ */

function setStatus(
  message,
  live = false
) {

  const status =
    $('status');

  if (status) {

    status.textContent =
      message;
  }


  const dot =
    $('dot');

  if (dot) {

    dot.classList.toggle(
      'live',
      live
    );
  }


  const statusText =
    $('statusText');

  if (statusText) {

    statusText.textContent =
      message;
  }
}


function clearDiagnostics() {

  const log =
    $('diagLog');

  if (log) {

    log.innerHTML =
      '';
  }
}


function diagnostic(
  message,
  state = 'wait'
) {

  const log =
    $('diagLog');

  if (!log)
    return;


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
          ${escapeHtml(time)}
        </span>

        <span class="${className}">
          ${symbol}
        </span>

        <span>
          ${escapeHtml(message)}
        </span>
      </div>
    `
  );
}


/* ============================================================
   LOAD CURATED CRISIS DATA
   ============================================================ */

async function loadCrisisData() {

  diagnostic(
    'Loading curated crisis data…'
  );

  const response =
    await fetch(
      CRISIS_DATA_URL,
      {
        cache: 'no-store'
      }
    );

  if (!response.ok) {

    throw new Error(
      `Could not load ${CRISIS_DATA_URL}: HTTP ${response.status}`
    );
  }

  const json =
    await response.json();

  if (!Array.isArray(json)) {

    throw new Error(
      'crises.json must contain an array.'
    );
  }

  crisisData =
    json;

  diagnostic(
    `Loaded ${crisisData.length} curated crisis records`,
    'ok'
  );
}


/* ============================================================
   LOAD RELIGION DATA
   ============================================================ */

async function loadReligionData() {

  diagnostic(
    'Loading World Religion Database data…'
  );

  const response =
    await fetch(
      RELIGION_DATA_URL,
      {
        cache: 'no-store'
      }
    );

  if (!response.ok) {

    throw new Error(
      `Could not load ${RELIGION_DATA_URL}: HTTP ${response.status}`
    );
  }

  const json =
    await response.json();


  /*
   * religion.json contains:
   *
   * {
   *   metadata: {...},
   *   countries: [...]
   * }
   */

  const countries =
    Array.isArray(json)
      ? json
      : json.countries;


  if (!Array.isArray(countries)) {

    throw new Error(
      'religion.json does not contain a countries array.'
    );
  }


  religionData =
    {};


  for (
    const country
    of countries
  ) {

    const iso =
      String(
        country.iso3 || ''
      )
      .trim()
      .toUpperCase();

    if (!iso)
      continue;

    religionData[iso] =
      country;
  }


  diagnostic(
    `Loaded ${Object.keys(religionData).length} Christian population records`,
    'ok'
  );
}


/* ============================================================
   LOOKUP CURATED CRISIS
   ============================================================ */

function getCrisis(
  iso3
) {

  const iso =
    String(
      iso3 || ''
    )
    .trim()
    .toUpperCase();

  return crisisData.find(
    crisis =>
      String(
        crisis.iso3 || ''
      )
      .trim()
      .toUpperCase() === iso
  ) || null;
}


/* ============================================================
   LOOKUP CHRISTIAN POPULATION
   ============================================================ */

function getReligion(
  iso3
) {

  const iso =
    String(
      iso3 || ''
    )
    .trim()
    .toUpperCase();

  return religionData[iso] ||
    null;
}


/* ============================================================
   BUILD HAPI URL
   ============================================================ */

function buildHAPIUrl(
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
   FETCH ONE HAPI PAGE
   ============================================================ */

async function fetchHAPIPage(
  offset
) {

  const url =
    buildHAPIUrl(
      offset
    );


  diagnostic(
    `Requesting records ${offset + 1}–${offset + PAGE_SIZE}`
  );


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        url.toString(),
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
        `HAPI returned HTTP ${response.status} ${response.statusText}`
      );
    }


    const json =
      await response.json();


    if (
      !json ||
      !Array.isArray(
        json.data
      )
    ) {

      throw new Error(
        'HAPI response did not contain a data array.'
      );
    }


    diagnostic(
      `Received ${json.data.length} records`,
      'ok'
    );


    return json.data;


  } catch (error) {

    if (
      error.name ===
      'AbortError'
    ) {

      throw new Error(
        'HAPI request timed out.'
      );
    }


    throw error;


  } finally {

    clearTimeout(
      timeout
    );
  }
}


/* ============================================================
   FETCH ENTIRE HAPI DATASET
   ============================================================ */

async function fetchAllPINRecords() {

  const allRecords =
    [];

  let offset =
    0;


  while (true) {

    const page =
      await fetchHAPIPage(
        offset
      );


    allRecords.push(
      ...page
    );


    if (
      page.length <
      PAGE_SIZE
    ) {

      break;
    }


    offset +=
      PAGE_SIZE;
  }


  diagnostic(
    `Global HAPI dataset: ${allRecords.length} records`,
    'ok'
  );


  return allRecords;
}


/* ============================================================
   SELECT LATEST TOTAL PIN PER COUNTRY
   ============================================================ */

function selectLatestPIN(
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


    if (!iso)
      continue;


    const population =
      toNumber(
        row.population
      );


    if (
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


  return [...countries.values()]
    .sort(
      (a, b) =>
        Number(b.population) -
        Number(a.population)
    );
}


/* ============================================================
   GLOBAL PIN
   ============================================================ */

function calculateGlobalPIN(
  countries
) {

  return countries.reduce(
    (
      total,
      row
    ) => {

      const value =
        toNumber(
          row.population
        );

      return total +
        (
          value === null
            ? 0
            : value
        );
    },

    0
  );
}


/* ============================================================
   CHRISTIAN PRESENCE FILTER
   ============================================================ */

function matchesPresenceFilter(
  row
) {

  if (
    !currentPresenceFilter
  ) {
    return true;
  }


  const crisis =
    getCrisis(
      row.location_code
    );


  if (
    currentPresenceFilter ===
    'unknown'
  ) {

    return !crisis;
  }


  if (!crisis)
    return false;


  return (
    crisis.christianPresence ===
    currentPresenceFilter
  );
}


/* ============================================================
   SEARCH FILTER
   ============================================================ */

function matchesSearch(
  row
) {

  if (!currentSearch)
    return true;


  const name =
    String(
      row.location_name ||
      ''
    ).toLowerCase();


  const iso =
    String(
      row.location_code ||
      ''
    ).toLowerCase();


  const crisis =
    getCrisis(
      row.location_code
    );


  const crisisName =
    String(
      crisis?.type ||
      ''
    ).toLowerCase();


  return (
    name.includes(
      currentSearch
    ) ||
    iso.includes(
      currentSearch
    ) ||
    crisisName.includes(
      currentSearch
    )
  );
}


/* ============================================================
   SORTING
   ============================================================ */

function getFilteredCountries() {

  let results =
    allPINCountries.filter(
      row =>
        matchesSearch(row) &&
        matchesPresenceFilter(row)
    );


  if (
    currentSort ===
    'name'
  ) {

    results.sort(
      (a, b) =>
        String(
          a.location_name || ''
        ).localeCompare(
          String(
            b.location_name || ''
          )
        )
    );

  } else if (
    currentSort ===
    'start'
  ) {

    results.sort(
      (a, b) => {

        const crisisA =
          getCrisis(
            a.location_code
          );

        const crisisB =
          getCrisis(
            b.location_code
          );

        const dateA =
          new Date(
            crisisA?.started ||
            '9999-12-31'
          );

        const dateB =
          new Date(
            crisisB?.started ||
            '9999-12-31'
          );

        return dateA -
          dateB;
      }
    );

  } else {

    results.sort(
      (a, b) =>
        Number(b.population) -
        Number(a.population)
    );
  }


  return results;
}


/* ============================================================
   COUNTRY CARD
   ============================================================ */

function createCountryCard(
  row,
  rank
) {

  const name =
    row.location_name ||
    row.location_code;


  const iso =
    String(
      row.location_code || ''
    )
    .trim()
    .toUpperCase();


  const population =
    toNumber(
      row.population
    );


  const referencePeriod =
    formatDateRange(
      row.reference_period_start,
      row.reference_period_end
    );


  const dataCurrency =
    getDataCurrency(
      row.reference_period_end
    );


  const crisis =
    getCrisis(
      iso
    );


  const religion =
    getReligion(
      iso
    );


  /*
   * Christian population
   */

  const christianPopulation =
    religion
      ? formatPercentage(
          religion.christianPopulationPercent
        )
      : 'Not available';


  /*
   * Local Christian presence
   */

  let christianPresenceLabel =
    'Evidence not established';

  let christianEvidence =
    'The dashboard has not established sufficient country-level evidence. This does not mean absence.';


  if (crisis) {

    christianPresenceLabel =
      crisis.christianLabel ||
      'Evidence established';

    christianEvidence =
      crisis.christianEvidence ||
      '';
  }


  /*
   * Crisis information
   */

  const crisisType =
    crisis?.type ||
    'Humanitarian crisis';


  const crisisStarted =
    crisis?.started
      ? formatDate(
          crisis.started
        )
      : 'Not established';


  /*
   * Country source links
   */

  let sourceLinksHtml =
    '';


  if (
    crisis &&
    Array.isArray(
      crisis.sourceLinks
    )
  ) {

    sourceLinksHtml =
      crisis.sourceLinks
        .map(
          link => {

            if (
              !Array.isArray(link) ||
              link.length < 2
            ) {
              return '';
            }

            return `
              <a
                href="${escapeHtml(link[1])}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ${escapeHtml(link[0])}
              </a>
            `;
          }
        )
        .filter(Boolean)
        .join(' · ');
  }


  /*
   * HAPI resource.
   *
   * resource_hdx_id is retained as an identifier.
   * The general HDX country page is used as the
   * dependable public navigation link.
   */

  const hdxCountryUrl =
    `https://data.humdata.org/country/${iso.toLowerCase()}`;


  return `

    <article
      class="card pin-card"
      data-iso="${escapeHtml(iso)}"
    >

      <div class="rank">
        ${rank}
      </div>


      <div class="country-main">

        <div class="country-header">

          <div>

            <h2>
              ${escapeHtml(name)}
            </h2>

            <span class="iso">
              ${escapeHtml(iso)}
            </span>

          </div>

        </div>


        <!-- PIN -->

        <div class="pin-number">

          ${formatCompact(
            population
          )}

        </div>


        <div class="pin-label">
          people in need
        </div>


        <div class="pin-exact">

          ${formatNumber(
            population
          )}

        </div>


        <!-- HUMANITARIAN ASSESSMENT -->

        <div class="data-section">

          <div class="data-label">
            HUMANITARIAN ASSESSMENT
          </div>

          <div class="data-value">
            ${escapeHtml(
              referencePeriod
            )}
          </div>

          <div class="data-note">
            ${escapeHtml(
              dataCurrency
            )}
          </div>

        </div>


        <!-- CRISIS -->

        <div class="data-section">

          <div class="data-label">
            CRISIS
          </div>

          <div class="data-value">
            ${escapeHtml(
              crisisType
            )}
          </div>

          <div class="data-note">

            Started:
            ${escapeHtml(
              crisisStarted
            )}

          </div>

        </div>


        <!-- CHRISTIAN CONTEXT -->

        <div class="data-section christian-section">

          <div class="data-label">
            CHRISTIAN CONTEXT
          </div>


          <div class="christian-stat">

            <span>
              Christian population
            </span>

            <strong>
              ${escapeHtml(
                christianPopulation
              )}
            </strong>

          </div>


          <div class="christian-source">

            World Religion Database · 2025

          </div>


          <div class="christian-presence">

            <span>
              Local Christian presence
            </span>

            <strong>
              ${escapeHtml(
                christianPresenceLabel
              )}
            </strong>

          </div>


          <div class="christian-evidence">

            ${escapeHtml(
              christianEvidence
            )}

          </div>

        </div>


        <!-- SOURCES -->

        <div class="source">

          <span>
            Humanitarian source:
            HDX HAPI / OCHA
          </span>

          <a
            href="${hdxCountryUrl}"
            target="_blank"
            rel="noopener noreferrer"
          >
            HDX ↗
          </a>

        </div>


        ${
          sourceLinksHtml
            ? `
              <div class="source">

                <span>
                  Country sources:
                </span>

                ${sourceLinksHtml}

              </div>
            `
            : ''
        }

      </div>

    </article>

  `;
}


/* ============================================================
   RENDER
   ============================================================ */

function renderPIN() {

  const grid =
    $('grid');

  if (!grid)
    return;


  const filtered =
    getFilteredCountries();


  const visible =
    filtered.slice(
      0,
      visibleCount
    );


  grid.innerHTML =
    visible
      .map(
        (row, index) =>
          createCountryCard(
            row,
            index + 1
          )
      )
      .join('');


  if (
    filtered.length ===
    0
  ) {

    grid.innerHTML = `

      <div class="error-state">

        <h2>
          No countries match your filters
        </h2>

        <p>
          Try a different search or Christian-presence filter.
        </p>

      </div>

    `;
  }


  /*
   * LOAD MORE
   */

  const loadMore =
    $('loadMore');


  if (loadMore) {

    const remaining =
      filtered.length -
      visibleCount;


    if (
      remaining > 0
    ) {

      loadMore.style.display =
        'block';

      loadMore.disabled =
        false;

      loadMore.textContent =
        `Load more · ${
          Math.min(
            LOAD_MORE_COUNT,
            remaining
          )
        } more countries`;

    } else {

      loadMore.style.display =
        'none';
    }
  }


  /*
   * SHOWING
   */

  const showing =
    $('showing');


  if (showing) {

    if (
      currentSearch ||
      currentPresenceFilter
    ) {

      showing.textContent =
        `Showing ${
          Math.min(
            visibleCount,
            filtered.length
          )
        } of ${
          filtered.length
        } matching countries`;

    } else {

      showing.textContent =
        `Showing ${
          Math.min(
            visibleCount,
            filtered.length
          )
        } of ${
          filtered.length
        } countries`;
    }
  }
}


/* ============================================================
   LOAD MORE
   ============================================================ */

function loadMorePIN() {

  if (isLoading)
    return;


  visibleCount +=
    LOAD_MORE_COUNT;


  renderPIN();


  const loadMore =
    $('loadMore');


  if (
    loadMore &&
    loadMore.style.display !==
    'none'
  ) {

    loadMore.focus();
  }
}


/* ============================================================
   UPDATE SUMMARY
   ============================================================ */

function updateSummary() {

  const globalPIN =
    calculateGlobalPIN(
      allPINCountries
    );


  const total =
    $('total');


  if (total) {

    total.textContent =
      formatCompact(
        globalPIN
      );
  }


  const recordCount =
    $('recordCount');


  if (recordCount) {

    recordCount.textContent =
      allPINCountries.length;
  }


  const liveCount =
    $('liveCount');


  if (liveCount) {

    liveCount.textContent =
      allPINCountries.length;
  }


  const refresh =
    $('refresh');


  if (refresh) {

    refresh.textContent =
      lastSuccessfulFetch
        ? lastSuccessfulFetch
            .toLocaleString()
        : '—';
  }
}


/* ============================================================
   SEARCH
   ============================================================ */

function searchCountries() {

  const search =
    $('search');


  currentSearch =
    search
      ? search.value
          .trim()
          .toLowerCase()
      : '';


  visibleCount =
    INITIAL_DISPLAY_COUNT;


  renderPIN();
}


/* ============================================================
   CLEAR SEARCH
   ============================================================ */

function clearSearch() {

  const search =
    $('search');


  if (search) {

    search.value =
      '';
  }


  currentSearch =
    '';

  visibleCount =
    INITIAL_DISPLAY_COUNT;


  renderPIN();
}


/* ============================================================
   PRESENCE FILTER
   ============================================================ */

function handlePresenceFilter() {

  const select =
    $('presence');


  currentPresenceFilter =
    select
      ? select.value
      : '';


  visibleCount =
    INITIAL_DISPLAY_COUNT;


  renderPIN();
}


/* ============================================================
   SORT
   ============================================================ */

function handleSort() {

  const select =
    $('sort');


  currentSort =
    select
      ? select.value
      : 'need';


  visibleCount =
    INITIAL_DISPLAY_COUNT;


  renderPIN();
}


/* ============================================================
   FULL REFRESH
   ============================================================ */

async function refreshDashboard() {

  if (isLoading)
    return;


  isLoading =
    true;


  clearDiagnostics();


  setStatus(
    'Loading global PIN data…',
    false
  );


  diagnostic(
    'GLOBAL HAPI PIN REFRESH'
  );


  diagnostic(
    'Endpoint: humanitarian-needs'
  );


  diagnostic(
    'Filters: Intersectoral / INN / admin level 0'
  );


  try {

    /*
     * Load contextual data first.
     */

    await Promise.all([
      loadCrisisData(),
      loadReligionData()
    ]);


    /*
     * Retrieve live HAPI data.
     */

    const records =
      await fetchAllPINRecords();


    diagnostic(
      'Selecting latest total PIN record for each country…'
    );


    const countries =
      selectLatestPIN(
        records
      );


    if (
      countries.length ===
      0
    ) {

      throw new Error(
        'HAPI returned records, but no country-level total PIN records matched the dashboard filters.'
      );
    }


    allPINCountries =
      countries;


    visibleCount =
      INITIAL_DISPLAY_COUNT;


    lastSuccessfulFetch =
      new Date();


    updateSummary();


    renderPIN();


    setStatus(
      `LIVE · HAPI · ${
        allPINCountries.length
      } countries`,
      true
    );


    diagnostic(
      `Selected ${
        allPINCountries.length
      } countries`,
      'ok'
    );


    diagnostic(
      `Largest PIN: ${
        allPINCountries[0]
          ?.location_name ||
        '—'
      } · ${
        formatNumber(
          allPINCountries[0]
            ?.population
        )
      }`,
      'ok'
    );


    diagnostic(
      'Global PIN dashboard successfully refreshed',
      'ok'
    );


  } catch (error) {

    console.error(
      'Dashboard refresh failed:',
      error
    );


    setStatus(
      'Live humanitarian data unavailable',
      false
    );


    diagnostic(
      `ERROR: ${error.message}`,
      'bad'
    );


    const grid =
      $('grid');


    if (grid) {

      grid.innerHTML = `

        <div class="error-state">

          <h2>
            Live humanitarian data unavailable
          </h2>

          <p>
            The dashboard could not retrieve
            current People in Need data or
            its supporting country datasets.
          </p>

          <p>
            Please try again.
          </p>

        </div>

      `;
    }


    const loadMore =
      $('loadMore');


    if (loadMore) {

      loadMore.style.display =
        'none';
    }


  } finally {

    isLoading =
      false;
  }
}


/* ============================================================
   EVENT HANDLERS
   ============================================================ */

const loadMoreButton =
  $('loadMore');

if (loadMoreButton) {

  loadMoreButton.addEventListener(
    'click',
    loadMorePIN
  );
}


const searchInput =
  $('search');

if (searchInput) {

  searchInput.addEventListener(
    'input',
    searchCountries
  );
}


const clearSearchButton =
  $('clearSearch');

if (clearSearchButton) {

  clearSearchButton.addEventListener(
    'click',
    clearSearch
  );
}


const presenceSelect =
  $('presence');

if (presenceSelect) {

  presenceSelect.addEventListener(
    'change',
    handlePresenceFilter
  );
}


const sortSelect =
  $('sort');

if (sortSelect) {

  sortSelect.addEventListener(
    'change',
    handleSort
  );
}


const refreshButton =
  $('refreshButton');

if (refreshButton) {

  refreshButton.addEventListener(
    'click',
    refreshDashboard
  );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

setStatus(
  'Connecting to HDX HAPI…',
  false
);


diagnostic(
  'Dashboard initialized',
  'ok'
);


diagnostic(
  'HAPI app identifier configured',
  HDX_HAPI_APP_ID
    ? 'ok'
    : 'bad'
);


/*
 * Initial live load.
 */

refreshDashboard();


/*
 * Automatic refresh every six hours.
 */

setInterval(
  refreshDashboard,
  REFRESH_INTERVAL_MS
);


/*
 * Preserve compatibility with existing HTML.
 */

window.loadMorePIN =
  loadMorePIN;

window.refreshDashboard =
  refreshDashboard;
