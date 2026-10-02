/*
 * ============================================================
 * GLOBAL HUMANITARIAN CRISIS DASHBOARD
 * ============================================================
 *
 * DATA SOURCE
 * -----------
 * HDX Humanitarian API (HAPI)
 *
 * DATASET
 * -------
 * People in Need (PIN)
 *
 * ENDPOINT
 * --------
 * /api/v1/affected-people/humanitarian-needs
 *
 * FILTERS
 * -------
 * sector_name       = Intersectoral
 * population_status = INN
 * admin_level       = 0
 * category          = ""
 *
 * DISPLAY
 * -------
 * - Top 12 countries initially
 * - "Load more" reveals another 12
 * - Latest reference period per country
 * - Sorted by PIN, descending
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

const PAGE_SIZE = 1000;

const INITIAL_DISPLAY_COUNT = 12;

const LOAD_MORE_COUNT = 12;

const REQUEST_TIMEOUT_MS = 30000;


/*
 * How frequently to refresh the HAPI data.
 *
 * Six hours is appropriate for a dashboard whose source
 * data may change less frequently than the webpage itself.
 */

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


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function $(id) {
  return document.getElementById(id);
}


/*
 * Safely escape text before inserting it into HTML.
 */

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
   NUMBER FORMATTING
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


/* ============================================================
   DATE FORMATTING
 * ============================================================ */

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

    const startDate =
      formatDate(start);

    const endDate =
      formatDate(end);

    return `${startDate} – ${endDate}`;
  }

  return formatDate(
    start || end
  );
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
}


function setLoading(
  loading
) {

  isLoading =
    loading;


  const loadMore =
    $('loadMore');

  if (loadMore) {

    loadMore.disabled =
      loading;

    if (loading) {

      loadMore.textContent =
        'Loading…';

    } else {

      loadMore.textContent =
        'Load more';
    }
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
   * These are the exact filters verified against the
   * live Afghanistan response supplied by the user.
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
   FETCH ONE PAGE
   ============================================================ */

async function fetchHAPIPage(
  offset
) {

  const url =
    buildHAPIUrl(
      offset
    );


  diagnostic(
    `Requesting records ${offset + 1}–${
      offset + PAGE_SIZE
    }`
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
        `HAPI returned HTTP ${
          response.status
        } ${
          response.statusText
        }`
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
      `Received ${
        json.data.length
      } records`,
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
   FETCH ENTIRE GLOBAL DATASET
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


    /*
     * A short page means that we have reached the end.
     */

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
    `Global HAPI dataset: ${
      allRecords.length
    } records`,
    'ok'
  );


  return allRecords;
}


/* ============================================================
   FILTER AND SELECT LATEST COUNTRY RECORD
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


    /*
     * We deliberately enforce all four conditions here,
     * even though they are also sent to the API.
     *
     * This protects the dashboard if HAPI returns additional
     * records or changes pagination behavior.
     */

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
     * The Afghanistan test showed that HAPI can return
     * demographic categories such as "Adult" and
     * "Adult - Female".
     *
     * We want the total PIN record only.
     */

    if (
      row.category !== ''
    ) {
      continue;
    }


    const iso =
      String(
        row.location_code || ''
      ).trim().toUpperCase();


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


    /*
     * First record for this country.
     */

    if (!existing) {

      countries.set(
        iso,
        row
      );

      continue;
    }


    /*
     * If multiple reference periods exist, retain
     * the newest one.
     */

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


  /*
   * Convert Map → array and sort largest PIN first.
   */

  return [...countries.values()]
    .sort(
      (a, b) =>
        Number(b.population) -
        Number(a.population)
    );
}


/* ============================================================
   GLOBAL TOTAL
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
   COUNTRY CARD
   ============================================================ */

function createCountryCard(
  row,
  rank
) {

  const name =
    row.location_name ||
    row.location_code;


  const population =
    toNumber(
      row.population
    );


  const referencePeriod =
    formatDateRange(
      row.reference_period_start,
      row.reference_period_end
    );


  /*
   * The resource_hdx_id allows us to link the displayed
   * number to its underlying HDX resource.
   */

  const resourceId =
    row.resource_hdx_id ||
    '';


  const hdxResourceUrl =
    resourceId
      ? `https://data.humdata.org/dataset/${resourceId}`
      : 'https://data.humdata.org/';


  return `

    <article
      class="card pin-card"
      data-iso="${escapeHtml(
        row.location_code
      )}"
    >

      <div class="rank">
        ${rank}
      </div>


      <div class="country-main">

        <div class="country-header">

          <h2>
            ${escapeHtml(name)}
          </h2>

          <span class="iso">
            ${escapeHtml(
              row.location_code
            )}
          </span>

        </div>


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


        <div class="reference">

          Reference period:
          <strong>
            ${escapeHtml(
              referencePeriod
            )}
          </strong>

        </div>


        <div class="source">

          <span>
            Source: HDX HAPI / OCHA
          </span>

          <a
            href="${hdxResourceUrl}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dataset ↗
          </a>

        </div>

      </div>

    </article>
  `;
}


/* ============================================================
   RENDER COUNTRY LIST
   ============================================================ */

function renderPIN() {

  const grid =
    $('grid');


  if (!grid)
    return;


  const visible =
    allPINCountries.slice(
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


  /*
   * Load More button
   */

  const loadMore =
    $('loadMore');


  if (loadMore) {

    const remaining =
      allPINCountries.length -
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
   * Number of countries shown.
   */

  const showing =
    $('showing');


  if (showing) {

    showing.textContent =
      `Showing ${
        Math.min(
          visibleCount,
          allPINCountries.length
        )
      } of ${
        allPINCountries.length
      } countries`;
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


  /*
   * Put keyboard focus back on the button when it remains
   * visible. This makes the interaction more accessible.
   */

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
   UPDATE DASHBOARD SUMMARY
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
      allPINCountries.length
    ;
  }


  const liveCount =
    $('liveCount');


  if (liveCount) {

    liveCount.textContent =
      allPINCountries.length
    ;
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


  if (!search)
    return;


  const query =
    search.value
      .trim()
      .toLowerCase();


  if (!query) {

    visibleCount =
      INITIAL_DISPLAY_COUNT;

    renderPIN();

    return;
  }


  const matches =
    allPINCountries.filter(
      row => {

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


        return (
          name.includes(query) ||
          iso.includes(query)
        );
      }
    );


  const grid =
    $('grid');


  if (!grid)
    return;


  grid.innerHTML =
    matches
      .map(
        (row, index) =>
          createCountryCard(
            row,
            index + 1
          )
      )
      .join('');


  const loadMore =
    $('loadMore');


  if (loadMore) {

    loadMore.style.display =
      'none';
  }


  const showing =
    $('showing');


  if (showing) {

    showing.textContent =
      `Showing ${
        matches.length
      } matching countries`;
  }
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
   FULL DATA REFRESH
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
      'HAPI PIN refresh failed:',
      error
    );


    setStatus(
      'HAPI unavailable · live PIN data unavailable',
      false
    );


    diagnostic(
      `ERROR: ${error.message}`,
      'bad'
    );


    /*
     * Do not silently display old or fabricated numbers.
     */

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
            current People in Need data from
            HDX HAPI.
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


/*
 * Load More
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
    searchCountries
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
 * Manual refresh
 */

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
 * First live load.
 */

refreshDashboard();


/*
 * Automatic refresh.
 */

setInterval(
  refreshDashboard,
  REFRESH_INTERVAL_MS
);


/* ============================================================
   EXPOSE LOAD MORE FOR EXISTING HTML
   ============================================================
 *
 * If the existing HTML uses:
 *
 *   onclick="loadMorePIN()"
 *
 * this keeps that markup working.
 *
 * ============================================================ */

window.loadMorePIN =
  loadMorePIN;


window.refreshDashboard =
  refreshDashboard;
