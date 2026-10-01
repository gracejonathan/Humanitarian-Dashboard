// Debug script to test OCHA API responses
async function debugOcha() {
  console.log("=== OCHA API Debug ===\n");
  
  const endpoints = [
    "https://api.hpc.tools/v2/public/plan",
    "https://api.hpc.tools/v2/public/plan?status=active",
    "https://api.hpc.tools/v1/public/plans"
  ];
  
  for (const url of endpoints) {
    try {
      console.log(`\n📡 Testing: ${url}`);
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const json = await response.json();
        console.log(`Response structure:`);
        console.log(JSON.stringify(json, null, 2).substring(0, 1000) + "...");
        
        // Try to extract country data
        const dataArray = Array.isArray(json) ? json : (json?.data || json?.plans || json?.results || []);
        console.log(`\nData array length: ${dataArray.length}`);
        
        if (dataArray.length > 0) {
          console.log(`First item:`, JSON.stringify(dataArray[0], null, 2).substring(0, 500));
        }
        
        // Look for country/iso3 patterns
        const countries = new Set();
        const extractCountries = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj.iso3) countries.add(obj.iso3);
          if (obj.country?.iso3) countries.add(obj.country.iso3);
          if (obj.country?.iso3Code) countries.add(obj.country.iso3Code);
          Object.values(obj).forEach(v => extractCountries(v));
        };
        
        dataArray.forEach(extractCountries);
        console.log(`Countries found: ${Array.from(countries).join(", ")}`);
      } else {
        console.log(`Error: ${response.statusText}`);
      }
    } catch (e) {
      console.error(`Failed: ${e.message}`);
    }
  }
}

// Run if this script is loaded
if (typeof window !== 'undefined') {
  debugOcha();
}
