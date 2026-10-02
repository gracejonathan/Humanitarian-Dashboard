#!/usr/bin/env node

/**
 * Fetch crisis data from OCHA HDX HAPI (Humanitarian API) v2 and write to data/crises.json
 * Docs: https://hapi.humdata.org/docs
 * This script runs server-side (via GitHub Actions), avoiding CORS issues.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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

const COUNTRY_REGIONS = {
  'AFG': 'South Asia', 'BGD': 'South Asia', 'BTN': 'South Asia', 'IND': 'South Asia', 'LKA': 'South Asia',
  'MDV': 'South Asia', 'NPL': 'South Asia', 'PAK': 'South Asia', 'CHN': 'East Asia', 'HKG': 'East Asia',
  'JPN': 'East Asia', 'KOR': 'East Asia', 'MNG': 'East Asia', 'PRK': 'East Asia', 'TWN': 'East Asia',
  'BRN': 'Southeast Asia', 'KHM': 'Southeast Asia', 'IDN': 'Southeast Asia', 'LAO': 'Southeast Asia',
  'MYS': 'Southeast Asia', 'MMR': 'Southeast Asia', 'PHL': 'Southeast Asia', 'SGP': 'Southeast Asia',
  'THA': 'Southeast Asia', 'TLS': 'Southeast Asia', 'VNM': 'Southeast Asia', 'ARM': 'Caucasus',
  'AZE': 'Caucasus', 'GEO': 'Caucasus', 'BLR': 'Europe', 'BGR': 'Europe', 'HRV': 'Europe', 'CZE': 'Europe',
  'DNK': 'Europe', 'EST': 'Europe', 'FIN': 'Europe', 'FRA': 'Europe', 'DEU': 'Europe', 'GRC': 'Europe',
  'HUN': 'Europe', 'IRL': 'Europe', 'ITA': 'Europe', 'LVA': 'Europe', 'LTU': 'Europe', 'LUX': 'Europe',
  'MLT': 'Europe', 'NLD': 'Europe', 'POL': 'Europe', 'PRT': 'Europe', 'ROU': 'Europe', 'RUS': 'Europe',
  'SVK': 'Europe', 'SVN': 'Europe', 'ESP': 'Europe', 'SWE': 'Europe', 'CHE': 'Europe', 'UKR': 'Europe',
  'GBR': 'Europe', 'TUR': 'Europe', 'BHR': 'Middle East', 'EGY': 'Middle East', 'IRN': 'Middle East',
  'IRQ': 'Middle East', 'ISR': 'Middle East', 'JOR': 'Middle East', 'KWT': 'Middle East', 'LBN': 'Middle East',
  'OMN': 'Middle East', 'PSE': 'Middle East', 'QAT': 'Middle East', 'SAU': 'Middle East', 'SYR': 'Middle East',
  'ARE': 'Middle East', 'YEM': 'Middle East', 'DZA': 'North Africa', 'LBY': 'North Africa', 'MAR': 'North Africa',
  'TUN': 'North Africa', 'AGO': 'Central Africa', 'CMR': 'Central Africa', 'CAF': 'Central Africa',
  'TCD': 'Central Africa', 'COG': 'Central Africa', 'COD': 'Central Africa', 'GAB': 'Central Africa',
  'GNQ': 'Central Africa', 'STP': 'Central Africa', 'BWA': 'Southern Africa', 'LSO': 'Southern Africa',
  'NAM': 'Southern Africa', 'ZAF': 'Southern Africa', 'SWZ': 'Southern Africa', 'BDI': 'East Africa',
  'KMR': 'East Africa', 'DJI': 'East Africa', 'ERI': 'East Africa', 'ETH': 'East Africa', 'KEN': 'East Africa',
  'MDG': 'East Africa', 'MWI': 'East Africa', 'MOZ': 'East Africa', 'RWA': 'East Africa', 'SOM': 'Horn of Africa',
  'SSD': 'East Africa', 'TZA': 'East Africa', 'UGA': 'East Africa', 'ZMB': 'East Africa', 'ZWE': 'East Africa',
  'BEN': 'West Africa', 'BFA': 'West Africa', 'CPV': 'West Africa', 'CIV': 'West Africa', 'GMB': 'West Africa',
  'GHA': 'West Africa', 'GIN': 'West Africa', 'GNB': 'West Africa', 'LBR': 'West Africa', 'MLI': 'West Africa',
  'MRT': 'West Africa', 'NER': 'West Africa', 'NGA': 'West Africa', 'SEN': 'West Africa', 'SLE': 'West Africa',
  'TGO': 'West Africa', 'ABW': 'Caribbean', 'BHS': 'Caribbean', 'BRB': 'Caribbean', 'CUB': 'Caribbean',
  'CUW': 'Caribbean', 'DMA': 'Caribbean', 'DOM': 'Caribbean', 'SXM': 'Caribbean', 'GRD': 'Caribbean',
  'GTM': 'Caribbean', 'HTI': 'Caribbean', 'JAM': 'Caribbean', 'PRI': 'Caribbean', 'BLZ': 'Central America',
  'CRI': 'Central America', 'SLV': 'Central America', 'HND': 'Central America', 'NIC': 'Central America',
  'PAN': 'Central America', 'ARG': 'South America', 'BOL': 'South America', 'BRA': 'South America',
  'CHL': 'South America', 'COL': 'South America', 'ECU': 'South America', 'GUY': 'South America',
  'PRY': 'South America', 'PER': 'South America', 'SUR': 'South America', 'URY': 'South America',
  'VEN': 'South America', 'AUS': 'Oceania', 'FJI': 'Oceania', 'KIR': 'Oceania', 'MHL': 'Oceania',
  'FSM': 'Oceania', 'NRU': 'Oceania', 'NZL': 'Oceania', 'PLW': 'Oceania', 'PNG': 'Oceania', 'WSM': 'Oceania',
  'SLB': 'Oceania', 'TON': 'Oceania', 'TUV': 'Oceania', 'VUT': 'Oceania', 'CAN': 'North America',
  'MEX': 'North America', 'USA': 'North America'
};

// Minimal country ISO3 -> full name lookup for presentation (HAPI returns this directly most of the time,
// but we keep a fallback in case a record is missing location_name)
const COUNTRY_NAMES = {
  'SDN': 'Sudan', 'AFG': 'Afghanistan', 'SYR': 'Syria', 'COD': 'Democratic Republic of the Congo',
  'UKR': 'Ukraine', 'YEM': 'Yemen', 'PSE': 'Occupied Palestinian Territory', 'MMR': 'Myanmar',
  'SOM': 'Somalia', 'ETH': 'Ethiopia', 'NGA': 'Nigeria', 'HTI': 'Haiti'
};

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Humanitarian-Dashboard/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (err) {
          resolve({ status: res.statusCode, json: null, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function fetchCrises() {
  const appIdentifier = 'humanitarian-dashboard';
  // HAPI humanitarian-needs endpoint: gives per-country, per-sector population in need figures.
  // This is a strong proxy for "active, data-backed humanitarian crises".
  const url = `https://hapi.humdata.org/api/v2/affected-people/humanitarian-needs?app_identifier=${encodeURIComponent(appIdentifier)}&output_format=json&limit=1000`;

  console.log(`[fetch-crises] Fetching OCHA HAPI humanitarian-needs data`);
  console.log(`[fetch-crises] URL: ${url}`);

  try {
    const { status, json, raw } = await fetchJSON(url);
    console.log(`[fetch-crises] HTTP status: ${status}`);

    if (!json) {
      console.log(`[fetch-crises] Could not parse JSON. Raw (first 300 chars): ${(raw || '').substring(0, 300)}`);
      return FALLBACK_CRISIS_SEED;
    }

    console.log(`[fetch-crises] Response keys: ${Object.keys(json).join(', ')}`);

    const records = json?.data;
    if (!Array.isArray(records)) {
      console.log(`[fetch-crises] No data array found. Response (first 300 chars): ${JSON.stringify(json).substring(0, 300)}`);
      return FALLBACK_CRISIS_SEED;
    }

    console.log(`[fetch-crises] HAPI returned ${records.length} humanitarian-needs records`);
    if (records.length > 0) {
      console.log(`[fetch-crises] Sample record keys: ${Object.keys(records[0]).join(', ')}`);
      console.log(`[fetch-crises] Sample record: ${JSON.stringify(records[0]).substring(0, 400)}`);
    }

    // Aggregate by country: collect sector names and max population_in_need, and reference_period_end as "started"/updated marker
    const byCountry = new Map();

    records.forEach((rec) => {
      const iso3 = (rec?.location_code || rec?.iso3 || '').toUpperCase();
      if (!iso3) return;

      const countryName = rec?.location_name || COUNTRY_NAMES[iso3] || iso3;
      const sector = rec?.sector_name || rec?.category || 'Humanitarian needs';
      const populationInNeed = Number(rec?.population || rec?.population_in_need || 0);
      const refEnd = rec?.reference_period_end || rec?.reference_period_start || null;

      if (!byCountry.has(iso3)) {
        byCountry.set(iso3, {
          iso3,
          name: countryName,
          sectors: new Set(),
          maxPopulation: 0,
          latestDate: refEnd
        });
      }

      const entry = byCountry.get(iso3);
      if (sector) entry.sectors.add(sector);
      if (populationInNeed > entry.maxPopulation) entry.maxPopulation = populationInNeed;
      if (refEnd && (!entry.latestDate || refEnd > entry.latestDate)) entry.latestDate = refEnd;
    });

    console.log(`[fetch-crises] Aggregated into ${byCountry.size} countries`);

    const normalized = Array.from(byCountry.values())
      .map((entry) => {
        const region = COUNTRY_REGIONS[entry.iso3] || 'Global';
        const sectorList = Array.from(entry.sectors).slice(0, 3).join(', ') || 'Humanitarian needs';

        return {
          id: entry.iso3.toLowerCase(),
          iso3: entry.iso3,
          name: entry.name,
          region,
          type: sectorList,
          started: entry.latestDate,
          christianPresence: 'documented',
          christianLabel: 'OCHA HAPI live source',
          christianEvidence: `Live humanitarian needs data from OCHA HDX HAPI; population in need: ${entry.maxPopulation.toLocaleString()}`,
          sourceLinks: [
            ['HDX HAPI', 'https://hapi.humdata.org/docs'],
            ['ReliefWeb', `https://reliefweb.int/country/${entry.iso3.toLowerCase()}`]
          ]
        };
      })
      .filter((c) => c.iso3 && c.iso3 !== 'UNK')
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[fetch-crises] Normalized ${normalized.length} countries with active humanitarian needs`);
    normalized.slice(0, 10).forEach((c, i) => {
      console.log(`[fetch-crises]   [${i}] ${c.name} (${c.iso3}) - ${c.region} - ${c.type}`);
    });

    if (normalized.length === 0) {
      console.log('[fetch-crises] No valid countries found; using fallback');
      return FALLBACK_CRISIS_SEED;
    }

    console.log(`[fetch-crises] Success: ${normalized.length} live crises from OCHA HAPI`);
    return normalized;
  } catch (error) {
    console.error(`[fetch-crises] Error fetching from OCHA HAPI: ${error.message}`);
    console.log('[fetch-crises] Using fallback crisis seed');
    return FALLBACK_CRISIS_SEED;
  }
}

async function main() {
  const crises = await fetchCrises();
  const output = { crises, timestamp: new Date().toISOString() };

  const outputDir = path.join(process.cwd(), 'data');
  const outputFile = path.join(outputDir, 'crises.json');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`[fetch-crises] Wrote ${crises.length} crises to ${outputFile}`);
}

main().catch(err => {
  console.error('[fetch-crises] Fatal error:', err);
  process.exit(1);
});
