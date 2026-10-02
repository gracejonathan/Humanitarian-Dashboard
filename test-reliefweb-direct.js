#!/usr/bin/env node

/**
 * Direct ReliefWeb API test - shows raw API response structure
 * Run: node test-reliefweb-direct.js
 */

const https = require('https');

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 
        'Accept': 'application/json', 
        'User-Agent': 'test-script/1.0'
      },
      timeout: 10000
    }, (res) => {
      console.log(`[HTTP] Status: ${res.statusCode}`);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          console.error(`[PARSE] Error parsing JSON:`, err.message);
          console.log(`[RAW] First 500 chars:`, data.substring(0, 500));
          reject(err);
        }
      });
    });
    
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

async function test() {
  console.log('=== ReliefWeb API v2 Direct Test ===\n');

  // Test 1: Most basic query possible
  console.log('Test 1: Most basic query (just limit)\n');
  try {
    const url = 'https://api.reliefweb.int/v2/disasters?limit=5';
    console.log(`URL: ${url}\n`);
    const json = await fetchJSON(url);
    
    console.log(`Response keys: ${Object.keys(json || {}).join(', ')}`);
    if (json.data) {
      console.log(`Total count: ${json.meta?.totalCount || '?'}`);
      console.log(`Returned items: ${json.data.length}`);
      
      if (json.data.length > 0) {
        console.log(`\nFirst item structure:`);
        const item = json.data[0];
        console.log(`  - id: ${item.id}`);
        console.log(`  - type: ${item.type}`);
        console.log(`  - fields keys: ${Object.keys(item.fields || {}).join(', ')}`);
        
        if (item.fields) {
          const f = item.fields;
          console.log(`\n  Field details:`);
          console.log(`    - name: ${f.name || 'N/A'}`);
          console.log(`    - status: ${f.status || 'N/A'}`);
          console.log(`    - country: ${Array.isArray(f.country) ? `[Array: ${f.country.length} items]` : f.country || 'N/A'}`);
          if (f.country && f.country[0]) {
            console.log(`      - country[0]: ${JSON.stringify(f.country[0])}`);
          }
          console.log(`    - type: ${Array.isArray(f.type) ? `[Array: ${f.type.length} items]` : f.type || 'N/A'}`);
          if (f.type && f.type[0]) {
            console.log(`      - type[0]: ${JSON.stringify(f.type[0])}`);
          }
          console.log(`    - disaster_type: ${Array.isArray(f.disaster_type) ? `[Array: ${f.disaster_type.length} items]` : f.disaster_type || 'N/A'}`);
          if (f.disaster_type && f.disaster_type[0]) {
            console.log(`      - disaster_type[0]: ${JSON.stringify(f.disaster_type[0])}`);
          }
          console.log(`    - date: ${JSON.stringify(f.date) || 'N/A'}`);
        }
        
        console.log(`\n  Full first item (JSON):`);
        console.log(JSON.stringify(json.data[0], null, 2).substring(0, 1000));
      }
    }
  } catch (error) {
    console.error(`✗ Failed: ${error.message}`);
  }

  // Test 2: With appname
  console.log('\n\n=== Test 2: With appname parameter ===\n');
  try {
    const url = 'https://api.reliefweb.int/v2/disasters?appname=humanitarian-dashboard&limit=2';
    console.log(`URL: ${url}\n`);
    const json = await fetchJSON(url);
    console.log(`✓ Success. Data count: ${json.data?.length || 0}`);
  } catch (error) {
    console.error(`✗ Failed: ${error.message}`);
  }

  // Test 3: Check what status values actually exist
  console.log('\n\n=== Test 3: What status values are in the data? ===\n');
  try {
    const url = 'https://api.reliefweb.int/v2/disasters?limit=50';
    console.log(`URL: ${url}\n`);
    const json = await fetchJSON(url);
    
    const statuses = new Set();
    json.data.forEach(item => {
      if (item.fields?.status) {
        statuses.add(item.fields.status);
      }
    });
    
    console.log(`Unique status values found: ${Array.from(statuses).join(', ') || '(none)'}`);
  } catch (error) {
    console.error(`✗ Failed: ${error.message}`);
  }
}

test().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
