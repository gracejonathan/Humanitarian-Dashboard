/*
 * ============================================================
 * GLOBAL HUMANITARIAN CRISIS DASHBOARD
 * ============================================================
 *
 * LIVE DATA
 * ---------
 * HDX Humanitarian API (HAPI)
 *
 * PRIMARY INDICATOR
 * -----------------
 * People in Need (PIN)
 *
 * SUPPORTING DATA
 * ---------------
 * data/religion.json
 *   World Religion Database
 *
 * data/crises.json
 *   Curated crisis chronology and Christian-presence context
 *
 * DISPLAY
 * -------
 * - 12 countries initially
 * - Load more reveals another 12
 * - Latest PIN reference period per country
 * - Sorted by PIN descending by default
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


const RELIGION_URL =
  'data/religion.json';


const CRISIS_URL =
  'data/crises.json';


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

let filteredCountries = [];

let religionData = [];

let crisisData = [];

let visibleCount =
  INITIAL_DISPLAY_COUNT;

let lastSuccessfulFetch =
  null;

let isLoading =
  false;


/* ============================================================
   DOM HELPER
   ============================================================ */

function $(id) {

  return document.getElementById(id);

}


/* ============================================================
   HTML ESCAPING
   ============================================================ */

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


/* ============================================================
   NUMBER HELPERS
   ============================================================ */

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


function formatNumber(value) {

  const number =
    toNumber(value);

  if (number === null) {

    return '—';

  }

  return new Intl.NumberFormat(
    'en-US'
  ).format(
    Math.round(number)
  );

}


function formatCompact(value) {

  const number =
    toNumber(value);

  if (number === null) {

    return '—';

  }


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


/* ============================================================
   DATE HELPERS
   ============================================================ */

function parseDate(value) {

  if (!value) {

    return null;

  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;

}


function formatDate(value) {

  const date =
    parseDate(value);

  if (!date) {

    return '—';

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

  if (!start && !end) {

    return '—';

  }


  if (start && end) {

    return (
      `${formatDate(start)} – ${formatDate(end)}`
    );

  }


  return formatDate(
    start || end
  );

}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
  message,
  live = false
) {

  const element =
    $('connectionStatus');

  if (!element) {

    return;

  }

  element.textContent =
    message;

  element.classList.toggle(
    'status-live',
    live
  );

  element.classList.toggle(
    'status-wait',
    !live
  );

}


/* ============================================================
   DIAGNOSTIC LOG
   ============================================================ */

function clearDiagnostics() {

  const log =
    $('connectionLog');

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
    $('connectionLog');

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


  /*
   * Country-level total intersectoral PIN.
   */

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


  /*
   * Empty category = total population,
   * not demographic subsets.
   */

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

  } finally {

    clearTimeout(
      timeout
    );

  }

}


/* ============================================================
   FETCH ALL HAPI RECORDS
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
   LOAD LOCAL JSON FILES
   ============================================================ */

async function loadSupportingData() {

  diagnostic(
    'Loading country religion data…'
  );


  diagnostic(
    'Loading crisis context data…'
  );


  const [
    religionResponse,
    crisisResponse
  ] = await Promise.all([
    fetch(
      RELIGION_URL,
      {
        cache: 'no-store'
      }
    ),
    fetch(
      CRISIS_URL,
      {
        cache: 'no-store'
      }
    )
  ]);


  if (!religionResponse.ok) {

    throw new Error(
      `Could not load ${RELIGION_URL} (HTTP ${religionResponse.status})`
    );

  }


  if (!crisisResponse.ok) {

    throw new Error(
      `Could not load ${CRISIS_URL} (HTTP ${crisisResponse.status})`
    );

  }


  const religionJson =
    await religionResponse.json();


  const crisisJson =
    await crisisResponse.json();


  /*
   * religion.json is expected to be an array.
   */

  religionData =
    Array.isArray(
      religionJson
    )
      ? religionJson
      : (
          Array.isArray(
            religionJson.data
          )
            ? religionJson.data
            : []
        );


  /*
   * crises.json is expected to be an array.
   */

  crisisData =
    Array.isArray(
      crisisJson
    )
      ? crisisJson
      : (
          Array.isArray(
            crisisJson.data
          )
            ? crisisJson.data
            : []
        );


  diagnostic(
    `Religion data: ${religionData.length} countries`,
    'ok'
  );


  diagnostic(
    `Crisis context: ${crisisData.length} records`,
    'ok'
  );

}


/* ============================================================
   SELECT LATEST PIN RECORD PER COUNTRY
   ============================================================ */

function selectLatestPIN(
  records
) {

  const countries =
    new Map();


  for (
    const row of records
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
     * Exclude demographic categories.
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


    if (!iso) {

      continue;

    }


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
      parseDate(
        existing.reference_period_end ||
        existing.reference_period_start
      );


    const currentDate =
      parseDate(
        row.reference_period_end ||
        row.reference_period_start
      );


    if (
      currentDate &&
      (
        !existingDate ||
        currentDate > existingDate
      )
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
   SUPPORTING DATA LOOKUPS
   ============================================================ */

function getReligion(
  iso
) {

  const code =
    String(
      iso || ''
    )
    .trim()
    .toUpperCase();


  return religionData.find(
    row =>
      String(
        row.iso3 || ''
      )
      .trim()
      .toUpperCase() === code
  ) || null;

}


function getCrisis(
  iso
) {

  const code =
    String(
      iso || ''
    )
    .trim()
    .toUpperCase();


  return crisisData.find(
    row =>
      String(
        row.iso3 || ''
      )
      .trim()
      .toUpperCase() === code
  ) || null;

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


      return (
        total +
        (
          value === null
            ? 0
            : value
        )
      );

    },
    0
  );

}


/* ============================================================
   CHRISTIAN PRESENCE LABEL
   ============================================================ */

function getPresenceLabel(
  crisis
) {

  if (!crisis) {

    return {
      label:
        'Not yet researched',
      className:
        'unknown'
    };

  }


  if (
    crisis.christianLabel
  ) {

    return {
      label:
        crisis.christianLabel,
      className:
        crisis.christianPresence ||
        'unknown'
    };

  }


  switch (
    crisis.christianPresence
  ) {

    case 'documented':

      return {
        label:
          'Documented Christian presence',
        className:
          'documented'
      };


    case 'limited':

      return {
        label:
          'Small / limited Christian presence',
        className:
          'limited'
      };


    default:

      return {
        label:
          'Not yet researched',
        className:
          'unknown'
      };

  }

}


/* ============================================================
   COUNTRY CARD
   ============================================================ */

function createCountryCard(
  row,
  rank
) {

  const iso =
    String(
      row.location_code || ''
    )
    .trim()
    .toUpperCase();


  const name =
    row.location_name ||
    iso;


  const population =
    toNumber(
      row.population
    );


  const religion =
    getReligion(
      iso
    );


  const crisis =
    getCrisis(
      iso
    );


  const christianPercent =
    religion
      ? toNumber(
          religion.christianPopulationPercent
        )
      : null;


  const presence =
    getPresenceLabel(
      crisis
    );


  const referencePeriod =
    formatDateRange(
      row.reference_period_start,
      row.reference_period_end
    );


  const resourceId =
    row.resource_hdx_id ||
    '';


  /*
   * HAPI's resource_hdx_id is an HDX resource identifier.
   * Use the HAPI resource metadata URL when possible.
   */

  const hdxResourceUrl =
    resourceId
      ? `https://data.humdata.org/dataset/${encodeURIComponent(resourceId)}`
      : 'https://data.humdata.org/';


  const crisisStarted =
    crisis
      ? formatDate(
          crisis.started
        )
      : 'Not yet researched';


  const crisisType =
    crisis
      ? crisis.type ||
        'Humanitarian crisis'
      : 'Not yet researched';


  const christianSourceYear =
    religion
      ? religion.year || ''
      : '';


  const christianSource =
    religion
      ? religion.source ||
        'World Religion Database'
      : '';


  return `

    <article
      class="card pin-card"
      data-iso="${escapeHtml(iso)}"
    >

      <div class="rank">
        ${rank}
      </div>


      <div class="country-main">


        <!-- COUNTRY HEADER -->

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

        <div class="metric-block">

          <div class="metric-label">
            PEOPLE IN NEED
          </div>

          <div class="pin-number">
            ${formatCompact(population)}
          </div>

          <div class="pin-exact">
            ${formatNumber(population)}
          </div>

        </div>


        <!-- REFERENCE PERIOD -->

        <div class="detail-row">

          <span>
            PIN reference period
          </span>

          <strong>
            ${escapeHtml(referencePeriod)}
          </strong>

        </div>


        <!-- CRISIS -->

        <div class="detail-section">

          <div class="detail-heading">
            CRISIS CONTEXT
          </div>

          <div class="detail-row">

            <span>
              Type
            </span>

            <strong>
              ${escapeHtml(crisisType)}
            </strong>

          </div>

          <div class="detail-row">

            <span>
              Started
            </span>

            <strong>
              ${escapeHtml(crisisStarted)}
            </strong>

          </div>

        </div>


        <!-- CHRISTIAN POPULATION -->

        <div class="detail-section christian-section">

          <div class="detail-heading">
            CHRISTIAN POPULATION
          </div>

          <div class="christian-stat">

            <strong>
              ${
                christianPercent !== null
                  ? christianPercent.toFixed(2) + '%'
                  : '—'
              }
            </strong>

            <span>
              of population
            </span>

          </div>

          ${
            religion
              ? `
                <div class="source-note">
                  ${escapeHtml(christianSource)}
                  ${christianSourceYear
                    ? ` · ${escapeHtml(christianSourceYear)}`
                    : ''}
                </div>
              `
              : `
                <div class="source-note">
                  No matching country record in religion.json
                </div>
              `
          }

        </div>


        <!-- CHRISTIAN PRESENCE -->

        <div class="detail-section">

          <div class="detail-heading">
            CHRISTIAN PRESENCE
          </div>

          <div
            class="presence ${escapeHtml(
              presence.className
            )}"
          >
            ${escapeHtml(
              presence.label
            )}
          </div>

          ${
            crisis && crisis.christianEvidence
              ? `
                <div class="source-note">
                  ${escapeHtml(
                    crisis.christianEvidence
                  )}
                </div>
              `
              : ''
          }

        </div>


        <!-- SOURCES -->

        <div class="source">

          <span>
            PIN: HDX HAPI / OCHA
          </span>

          <a
            href="${hdxResourceUrl}"
            target="_blank"
            rel="noopener noreferrer"
          >
            HDX dataset ↗
          </a>

        </div>


        ${
          crisis &&
          Array.isArray(
            crisis.sourceLinks
          ) &&
          crisis.sourceLinks.length
            ? `
              <div class="source-links">

                ${
                  crisis.sourceLinks
                    .map(
                      link => {

                        if (
                          !Array.isArray(
                            link
                          ) ||
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
                            ${escapeHtml(link[0])} ↗
                          </a>
                        `;

                      }
                    )
                    .join('')
                }

              </div>
            `
            : ''
        }

      </div>

    </article>

  `;

}


/* ============================================================
   APPLY FILTERS AND SORT
   ============================================================ */

function getFilteredCountries() {

  const searchInput =
    $('search');


  const presenceSelect =
    $('presence');


  const sortSelect =
    $('sort');


  const query =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : '';


  const presenceFilter =
    presenceSelect
      ? presenceSelect.value
      : '';


  const sort =
    sortSelect
      ? sortSelect.value
      : 'need';


  let results =
    [...allPINCountries];


  /*
   * SEARCH
   */

  if (query) {

    results =
      results.filter(
        row => {

          const iso =
            String(
              row.location_code || ''
            )
            .toLowerCase();


          const name =
            String(
              row.location_name || ''
            )
            .toLowerCase();


          return (
            iso.includes(query) ||
            name.includes(query)
          );

        }
      );

  }


  /*
   * CHRISTIAN PRESENCE
   */

  if (presenceFilter) {

    results =
      results.filter(
        row => {

          const crisis =
            getCrisis(
              row.location_code
            );


          const value =
            crisis
              ? crisis.christianPresence
              : 'unknown';


          return (
            value ===
            presenceFilter
          );

        }
      );

  }


  /*
   * SORT
   */

  results.sort(
    (a, b) => {

      if (sort === 'name') {

        return String(
          a.location_name || ''
        ).localeCompare(
          String(
            b.location_name || ''
          )
        );

      }


      if (sort === 'start') {

        const crisisA =
          getCrisis(
            a.location_code
          );


        const crisisB =
          getCrisis(
            b.location_code
          );


        const dateA =
          parseDate(
            crisisA?.started
          );


        const dateB =
          parseDate(
            crisisB?.started
          );


        if (!dateA && !dateB)
          return 0;


        if (!dateA)
          return 1;


        if (!dateB)
          return -1;


        return (
          dateA.getTime() -
          dateB.getTime()
        );

      }


      if (
        sort ===
        'christian'
      ) {

        const religionA =
          getReligion(
            a.location_code
          );


        const religionB =
          getReligion(
            b.location_code
          );


        const percentA =
          toNumber(
            religionA?.christianPopulationPercent
          ) ?? -1;


        const percentB =
          toNumber(
            religionB?.christianPopulationPercent
          ) ?? -1;


        return (
          percentB -
          percentA
        );

      }


      /*
       * Default:
       * PIN descending.
       */

      return (
        Number(b.population) -
        Number(a.population)
      );

    }
  );


  return results;

}


/* ============================================================
   RENDER
   ============================================================ */

function renderPIN() {

  const grid =
    $('crisisGrid');


  if (!grid) {

    return;

  }


  filteredCountries =
    getFilteredCountries();


  const visible =
    filteredCountries.slice(
      0,
      visibleCount
    );


  if (
    visible.length === 0
  ) {

    grid.innerHTML = `

      <div class="error-state">

        <h2>
          No countries found
        </h2>

        <p>
          Try changing the search or filter.
        </p>

      </div>

    `;

  } else {

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

  }


  /*
   * SHOWING TEXT
   */

  const showing =
    $('showing');


  if (showing) {

    const showingCount =
      Math.min(
        visibleCount,
        filteredCountries.length
      );


    if (
      searchValue() ||
      presenceValue()
    ) {

      showing.textContent =
        `Showing ${showingCount} of ${filteredCountries.length} matching countries`;

    } else {

      showing.textContent =
        `Showing ${showingCount} of ${filteredCountries.length} countries`;

    }

  }


  /*
   * LOAD MORE
   */

  const loadMore =
    $('loadMore');


  if (!loadMore) {

    return;

  }


  const remaining =
    filteredCountries.length -
    visibleCount;


  if (
    remaining > 0
  ) {

    loadMore.style.display =
      'inline-block';


    loadMore.disabled =
      false;


    loadMore.textContent =
      `Load more · ${Math.min(
        LOAD_MORE_COUNT,
        remaining
      )} more countries`;

  } else {

    loadMore.style.display =
      'none';

  }

}


/* ============================================================
   FILTER VALUE HELPERS
   ============================================================ */

function searchValue() {

  const input =
    $('search');


  return input
    ? input.value.trim()
    : '';

}


function presenceValue() {

  const select =
    $('presence');


  return select
    ? select.value
    : '';

}


/* ============================================================
   SUMMARY
   ============================================================ */

function updateSummary() {

  const total =
    calculateGlobalPIN(
      allPINCountries
    );


  const totalElement =
    $('totalNeed');


  if (totalElement) {

    totalElement.textContent =
      formatCompact(
        total
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
    $('lastRefresh');


  if (refresh) {

    refresh.textContent =
      lastSuccessfulFetch
        ? lastSuccessfulFetch.toLocaleString()
        : '—';

  }

}


/* ============================================================
   LOAD MORE
   ============================================================ */

function loadMorePIN() {

  if (isLoading) {

    return;

  }


  visibleCount +=
    LOAD_MORE_COUNT;


  renderPIN();

}


/* ============================================================
   SEARCH
   ============================================================ */

function handleSearch() {

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


  visibleCount =
    INITIAL_DISPLAY_COUNT;


  renderPIN();

}


/* ============================================================
   FULL REFRESH
   ============================================================ */

async function refreshDashboard() {

  if (isLoading) {

    return;

  }


  isLoading =
    true;


  clearDiagnostics();


  setStatus(
    'Connecting to live humanitarian data…',
    false
  );


  diagnostic(
    'GLOBAL HUMANITARIAN DATA REFRESH'
  );


  diagnostic(
    'HDX Humanitarian API'
  );


  diagnostic(
    'Endpoint: affected-people/humanitarian-needs'
  );


  diagnostic(
    'Filters: Intersectoral / INN / admin level 0'
  );


  try {

    /*
     * Load local supporting data and live HAPI data.
     */

    const [
      records
    ] = await Promise.all([
      fetchAllPINRecords(),
      loadSupportingData()
    ]);


    diagnostic(
      'Selecting latest total PIN record for each country…'
    );


    const countries =
      selectLatestPIN(
        records
      );


    if (
      countries.length === 0
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
      `LIVE · HAPI · ${allPINCountries.length} countries`,
      true
    );


    diagnostic(
      `Selected ${allPINCountries.length} countries`,
      'ok'
    );


    diagnostic(
      `Largest PIN: ${
        allPINCountries[0]?.location_name ||
        '—'
      } · ${
        formatNumber(
          allPINCountries[0]?.population
        )
      }`,
      'ok'
    );


    diagnostic(
      'Religion and crisis context loaded',
      'ok'
    );


    diagnostic(
      'Dashboard successfully refreshed',
      'ok'
    );


  } catch (error) {

    console.error(
      'Dashboard refresh failed:',
      error
    );


    setStatus(
      'Live data unavailable',
      false
    );


    diagnostic(
      `ERROR: ${error.message}`,
      'bad'
    );


    const grid =
      $('crisisGrid');


    if (grid) {

      grid.innerHTML = `

        <div class="error-state">

          <h2>
            Live humanitarian data unavailable
          </h2>

          <p>
            The dashboard could not retrieve the
            current People in Need data or supporting
            country data.
          </p>

          <p>
            Check your internet connection and try
            Refresh now again.
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


/*
 * Refresh
 */

const refreshButton =
  $('refreshBtn');


if (refreshButton) {

  refreshButton.addEventListener(
    'click',
    refreshDashboard
  );

}


/*
 * Load more
 */

const loadMoreButton =
  $('loadMore');


if (loadMoreButton) {

  loadMoreButton.addEventListener(
    'click',
    loadMorePIN
  );

}


/*
 * Search
 */

const searchInput =
  $('search');


if (searchInput) {

  searchInput.addEventListener(
    'input',
    handleSearch
  );

}


/*
 * Clear search
 */

const clearSearchButton =
  $('clearSearch');


if (clearSearchButton) {

  clearSearchButton.addEventListener(
    'click',
    clearSearch
  );

}


/*
 * Christian-presence filter
 */

const presenceSelect =
  $('presence');


if (presenceSelect) {

  presenceSelect.addEventListener(
    'change',
    handleSearch
  );

}


/*
 * Sort
 */

const sortSelect =
  $('sort');


if (sortSelect) {

  sortSelect.addEventListener(
    'change',
    handleSearch
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
 * Automatic six-hour refresh.
 */

setInterval(
  refreshDashboard,
  REFRESH_INTERVAL_MS
);


/*
 * Preserve compatibility with existing markup.
 */

window.loadMorePIN =
  loadMorePIN;


window.refreshDashboard =
  refreshDashboard;
