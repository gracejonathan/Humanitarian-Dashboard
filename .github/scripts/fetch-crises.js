#!/usr/bin/env node

/**
 * Fetch crisis data from ReliefWeb API v2 and write to data/crises.json
 * This script runs server-side (via GitHub Actions), avoiding CORS issues.
 * 
 * Tries multiple API query strategies to find active disasters.
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

// Hardcoded country ISO3 to region mapping
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
  'GBR': 'Europe', 'BHR': 'Middle East', 'EGY': 'Middle East', 'IRN': 'Middle East', 'IRQ': 'Middle East',
  'ISR': 'Middle East', 'JOR': 'Middle East', 'KWT': 'Middle East', 'LBN': 'Middle East', 'OMN': 'Middle East',
  'PSE': 'Middle East', 'QAT': 'Middle East', 'SAU': 'Middle East', 'SYR': 'Middle East', 'ARE': 'Middle East',
  'YEM': 'Middle East', 'DZA': 'North Africa', 'LBY': 'North Africa', 'MAR': 'North Africa', 'TUN': 'North Africa',
  'AGO': 'Central Africa', 'CMR': 'Central Africa', 'CAF': 'Central Africa', 'TCD': 'Central Africa',
  'COG': 'Central Africa', 'COD': 'Central Africa', 'GAB': 'Central Africa', 'GNQ': 'Central Africa',
  'STP': 'Central Africa', 'BWA': 'Southern Africa', 'LSO': 'Southern Africa', 'NAM': 'Southern Africa',
  'ZAF': 'Southern Africa', 'SWZ': 'Southern Africa', 'BDI': 'East Africa', 'KMR': 'East Africa',
  'DJI': 'East Africa', 'ERI': 'East Africa', 'ETH': 'East Africa', 'KEN': 'East Africa', 'MDG': 'East Africa',
  'MWI': 'East Africa', 'MOZ': 'East Africa', 'RWA': 'East Africa', 'SOM': 'Horn of Africa', 'SSD': 'East Africa',
  'TZA': 'East Africa', 'UGA': 'East Africa', 'ZMB': 'East Africa', 'ZWE': 'East Africa', 'BEN': 'West Africa',
  'BFA': 'West Africa', 'CPV': 'West Africa', 'CIV': 'West Africa', 'GMB': 'West Africa', 'GHA': 'West Africa',
  'GIN': 'West Africa', 'GNB': 'West Africa', 'LBR': 'West Africa', 'MLI': 'West Africa', 'MRT': 'West Africa',
  'NER': 'West Africa', 'NGA': 'West Africa', 'SEN': 'West Africa', 'SLE': 'West Africa', 'TGO': 'West Africa',
  'ABW': 'Caribbean', 'BHS': 'Caribbean', 'BRB': 'Caribbean', 'CUB': 'Caribbean', 'CUW': 'Caribbean',
  'DMA': 'Caribbean', 'DOM': 'Caribbean', 'SXM': 'Caribbean', 'GRD': 'Caribbean', 'GTM': 'Caribbean',
  'HTI': 'Caribbean', 'JAM': 'Caribbean', 'PRI': 'Caribbean', 'BLZ': 'Central America', 'CRI': 'Central America',
  'SLV': 'Central America', 'HND': 'Central America', 'NIC': 'Central America', 'PAN': 'Central America',
  'ARG': 'South America', 'BOL': 'South America', 'BRA': 'South America', 'CHL': 'South America',
  'COL': 'South America', 'ECU': 'South America', 'GUY': 'South America', 'PRY': 'South America',
  'PER': 'South America', 'SUR': 'South America', 'URY': 'South America', 'VEN': 'South America',
  'AUS': 'Oceania', 'FJI': 'Oceania', 'KIR': 'Oceania', 'MHL': 'Oceania', 'FSM': 'Oceania', 'NRU': 'Oceania',
  'NZL': 'Oceania', 'PLW': 'Oceania', 'PNG': 'Oceania', 'WSM': 'Oceania', 'SLB': 'Oceania', 'TON': 'Oceania',
  'TUV': 'Oceania', 'VUT': 'Oceania', 'CAN': 'North America', 'MEX': 'North America', 'USA': 'North America'
};

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Humanitarian-Dashboard/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function normalizeCrises(jsonData) {
  if (!jsonData || !jsonData.data || !Array.isArray(jsonData.data)) {
    return null;
  }

  const normalized = jsonData.data
    .map((item, idx) => {
      const fields = item?.fields || {};
      const name = fields?.name || 'Unknown Crisis';
      
      // Try both 'type' and 'disaster_type' fields
      const typeArray = fields?.disaster_type || fields?.type || [];
      const type = typeArray?.[0]?.name || 'Humanitarian emergency';
      
      // ReliefWeb returns 'country' as an array, get the first country's ISO3
      let iso3 = '';
      if (Array.isArray(fields?.country) && fields.country.length > 0) {
        iso3 = fields.country[0]?.iso3 || '';
      }
      iso3 = iso3.toUpperCase();
      
      const started = fields?.date?.start || fields?.date?.created || null;
      const region = COUNTRY_REGIONS[iso3] || 'Global';

      if (idx < 5) {
        console.log(`[fetch-crises] Item ${idx}: ${name} (${iso3}) - ${type}`);
      }

      return {
        id: (iso3 || name).toLowerCase().replace(/\s+/g, '-'),
        iso3: iso3 || 'UNK',
        name,
        region,
        type,
        started,
        christianPresence: 'documented',
        christianLabel: 'ReliefWeb live source',
        christianEvidence: 'Live crisis source from ReliefWeb API v2; source-backed until verified',
        sourceLinks: [['ReliefWeb', `https://reliefweb.int/disasters/${item?.id || ''}`], ['ReliefWeb Map', 'https://reliefweb.int/map']]
      };
    })
    .filter(crisis => crisis.iso3 !== 'UNK');

  return normalized.length > 0 ? normalized : null;
}

async function fetchCrises() {
  const appname = 'humanitarian-dashboard';
  
  // Strategy 1: Try filtered query for current disasters
  console.log('[fetch-crises] Strategy 1: Filtered query (status=current)');
  try {
    const url1 = `https://api.reliefweb.int/v2/disasters?appname=${encodeURIComponent(appname)}&filter[field]=status&filter[value]=current&limit=200`;
    console.log(`[fetch-crises] Trying: ${url1}`);
    const json1 = await fetchJSON(url1);
    console.log(`[fetch-crises] Response keys: ${Object.keys(json1 || {}).join(', ')}`);
    console.log(`[fetch-crises] Data count: ${json1?.data?.length || 0}`);
    
    const normalized1 = normalizeCrises(json1);
    if (normalized1 && normalized1.length > 0) {
      console.log(`[fetch-crises] ✓ Strategy 1 succeeded: ${normalized1.length} crises found`);
      return normalized1;
    }
  } catch (error) {
    console.log(`[fetch-crises] Strategy 1 failed: ${error.message}`);
  }

  // Strategy 2: Try emergencies endpoint instead
  console.log('\n[fetch-crises] Strategy 2: Emergencies endpoint');
  try {
    const url2 = `https://api.reliefweb.int/v2/emergencies?appname=${encodeURIComponent(appname)}&limit=200`;
    console.log(`[fetch-crises] Trying: ${url2}`);
    const json2 = await fetchJSON(url2);
    console.log(`[fetch-crises] Response keys: ${Object.keys(json2 || {}).join(', ')}`);
    console.log(`[fetch-crises] Data count: ${json2?.data?.length || 0}`);
    
    const normalized2 = normalizeCrises(json2);
    if (normalized2 && normalized2.length > 0) {
      console.log(`[fetch-crises] ✓ Strategy 2 succeeded: ${normalized2.length} crises found`);
      return normalized2;
    }
  } catch (error) {
    console.log(`[fetch-crises] Strategy 2 failed: ${error.message}`);
  }

  // Strategy 3: Try basic disasters endpoint without filters
  console.log('\n[fetch-crises] Strategy 3: Basic disasters (no filters)');
  try {
    const url3 = `https://api.reliefweb.int/v2/disasters?appname=${encodeURIComponent(appname)}&limit=200&sort=date:desc`;
    console.log(`[fetch-crises] Trying: ${url3}`);
    const json3 = await fetchJSON(url3);
    console.log(`[fetch-crises] Response keys: ${Object.keys(json3 || {}).join(', ')}`);
    console.log(`[fetch-crises] Data count: ${json3?.data?.length || 0}`);
    
    const normalized3 = normalizeCrises(json3);
    if (normalized3 && normalized3.length > 0) {
      console.log(`[fetch-crises] ✓ Strategy 3 succeeded: ${normalized3.length} crises found`);
      return normalized3;
    }
  } catch (error) {
    console.log(`[fetch-crises] Strategy 3 failed: ${error.message}`);
  }

  // Strategy 4: Try with fields specification
  console.log('\n[fetch-crises] Strategy 4: With fields filter');
  try {
    const url4 = `https://api.reliefweb.int/v2/disasters?appname=${encodeURIComponent(appname)}&fields[include]=name,country,type,disaster_type,date&limit=200`;
    console.log(`[fetch-crises] Trying: ${url4}`);
    const json4 = await fetchJSON(url4);
    console.log(`[fetch-crises] Response keys: ${Object.keys(json4 || {}).join(', ')}`);
    console.log(`[fetch-crises] Data count: ${json4?.data?.length || 0}`);
    
    const normalized4 = normalizeCrises(json4);
    if (normalized4 && normalized4.length > 0) {
      console.log(`[fetch-crises] ✓ Strategy 4 succeeded: ${normalized4.length} crises found`);
      return normalized4;
    }
  } catch (error) {
    console.log(`[fetch-crises] Strategy 4 failed: ${error.message}`);
  }

  console.log('\n[fetch-crises] All strategies failed; using fallback crisis seed');
  return FALLBACK_CRISIS_SEED;
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
