#!/usr/bin/env node

/**
 * Debug script to test ReliefWeb API v2 directly
 * Run locally: node test-reliefweb-api.js
 */

const https = require('https');

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Humanitarian-Dashboard/1.0' } }, (res) => {
      console.log(`[API] Status: ${res.statusCode}`);
      console.log(`[API] Headers:`, res.headers);
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

async function test() {
  console.log('Testing ReliefWeb API v2 endpoints...\n');

  // Test 1: Disasters endpoint with appname
  console.log('=== Test 1: Disasters endpoint with appname ===');
  try {
    const appname = 'humanitarian-dashboard';
    const url1 = `https://api.reliefweb.int/v2/disasters?appname=${encodeURIComponent(appname)}&limit=100`;
    console.log(`URL: ${url1}\n`);
    const json1 = await fetchJSON(url1);
    console.log(`Response keys: ${Object.keys(json1 || {}).join(', ')}`);
    if (json1?.data) {
      console.log(`Data array length: ${json1.data.length}`);
      if (json1.data[0]) {
        console.log(`First item keys: ${Object.keys(json1.data[0]).join(', ')}`);
        console.log(`First item fields keys: ${Object.keys(json1.data[0]?.fields || {}).join(', ')}`);
        console.log(`First item:`, JSON.stringify(json1.data[0], null, 2).substring(0, 800));
      }
    }
    console.log(`\n✓ Disasters endpoint returned data\n`);
  } catch (error) {
    console.error(`✕ Disasters endpoint failed: ${error.message}\n`);
  }

  // Test 2: Disasters endpoint without appname
  console.log('=== Test 2: Disasters endpoint without appname ===');
  try {
    const url2 = 'https://api.reliefweb.int/v2/disasters?limit=20';
    console.log(`URL: ${url2}\n`);
    const json2 = await fetchJSON(url2);
    console.log(`Response keys: ${Object.keys(json2 || {}).join(', ')}`);
    if (json2?.data) {
      console.log(`Data array length: ${json2.data.length}`);
      if (json2.data[0]) {
        const item = json2.data[0];
        console.log(`First item name: ${item?.fields?.name || 'N/A'}`);
        console.log(`First item iso3: ${item?.fields?.primary_country?.iso3 || 'N/A'}`);
        console.log(`First item type: ${item?.fields?.type?.[0]?.name || 'N/A'}`);
        console.log(`First item started: ${item?.fields?.date?.start || item?.fields?.date?.created || 'N/A'}`);
      }
    }
    console.log(`\n✓ Disasters endpoint (no appname) returned data\n`);
  } catch (error) {
    console.error(`✕ Disasters endpoint (no appname) failed: ${error.message}\n`);
  }

  // Test 3: Emergency endpoint
  console.log('=== Test 3: Emergency endpoint ===');
  try {
    const url3 = 'https://api.reliefweb.int/v2/emergencies?limit=20';
    console.log(`URL: ${url3}\n`);
    const json3 = await fetchJSON(url3);
    console.log(`Response keys: ${Object.keys(json3 || {}).join(', ')}`);
    if (json3?.data) {
      console.log(`Data array length: ${json3.data.length}`);
      if (json3.data[0]) {
        const item = json3.data[0];
        console.log(`First item name: ${item?.fields?.name || 'N/A'}`);
        console.log(`First item iso3: ${item?.fields?.primary_country?.iso3 || 'N/A'}`);
      }
    }
    console.log(`\n✓ Emergency endpoint returned data\n`);
  } catch (error) {
    console.error(`✕ Emergency endpoint failed: ${error.message}\n`);
  }

  // Test 4: Disasters with specific fields
  console.log('=== Test 4: Disasters with specific fields filter ===');
  try {
    const url4 = 'https://api.reliefweb.int/v2/disasters?fields[include]=name,primary_country,type,date&limit=10';
    console.log(`URL: ${url4}\n`);
    const json4 = await fetchJSON(url4);
    if (json4?.data?.length > 0) {
      console.log(`Retrieved ${json4.data.length} disasters with fields filter`);
      json4.data.slice(0, 3).forEach((item, i) => {
        const f = item?.fields || {};
        console.log(`  ${i+1}. ${f.name || 'N/A'} (${f.primary_country?.iso3 || 'N/A'})`);
      });
    }
    console.log(`\n✓ Fields filter worked\n`);
  } catch (error) {
    console.error(`✕ Fields filter failed: ${error.message}\n`);
  }
}

test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
