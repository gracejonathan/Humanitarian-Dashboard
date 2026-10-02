#!/usr/bin/env node

/**
 * Fetch crisis data from ReliefWeb API v2 and write to data/crises.json
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

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
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

async function fetchCrises() {
  const appname = 'humanitarian-dashboard';
  const url = `https://api.reliefweb.int/v2/disasters?appname=${encodeURIComponent(appname)}&limit=50`;

  console.log(`[fetch-crises] Fetching from ${url}`);

  try {
    const json = await fetchJSON(url);
    if (!json || !json.data || !Array.isArray(json.data)) {
      console.log('[fetch-crises] Invalid response structure; using fallback');
      return FALLBACK_CRISIS_SEED;
    }

    const normalized = json.data
      .map(item => {
        const fields = item?.fields || {};
        const name = fields?.name || 'Unknown Crisis';
        const iso3 = (fields?.primary_country?.iso3 || '').toUpperCase();
        const started = fields?.date?.created || fields?.date?.start || null;
        const type = fields?.type?.[0]?.name || 'Humanitarian emergency';
        const region = fields?.primary_country?.region?.name || 'Global';

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
      .filter(crisis => crisis.iso3 !== 'UNK')
      .slice(0, 12);

    if (normalized.length === 0) {
      console.log('[fetch-crises] No crises with ISO3 codes; using fallback');
      return FALLBACK_CRISIS_SEED;
    }

    console.log(`[fetch-crises] Fetched ${normalized.length} live crises from ReliefWeb`);
    return normalized;
  } catch (error) {
    console.error(`[fetch-crises] Error fetching from ReliefWeb: ${error.message}`);
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
