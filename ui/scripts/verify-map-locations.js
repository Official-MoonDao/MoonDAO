// One-off verification: replicate fetchCitizensWithLocation's location logic
// against the live Tableland data and report where every citizen would render.
// Usage: node scripts/verify-map-locations.js
const fs = require('fs')
const path = require('path')

// Read GOOGLE_MAPS_API_KEY from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const apiKey = envFile.match(/^GOOGLE_MAPS_API_KEY=(.*)$/m)?.[1]?.trim()
if (!apiKey) {
  console.error('No GOOGLE_MAPS_API_KEY in .env.local')
  process.exit(1)
}

function isAntarcticaName(name) {
  const lower = name.trim().toLowerCase()
  return lower === 'antarctica' || lower === 'antartica'
}

function isSentinelCoord(lat, lng) {
  return (lat === -90 && lng === 0) || (lat === 0 && lng === 0)
}

// Mirrors parseLocationData in citizenDataService.ts. Input is the attribute
// value, i.e. JSON.stringify(row.location) per convertRow.ts.
function parseLocationData(citizenLocation) {
  if (!citizenLocation || citizenLocation.trim() === '') {
    return { name: '', lat: null, lng: null }
  }
  const trimmed = citizenLocation.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
      const lat = typeof parsed.lat === 'number' ? parsed.lat : null
      const lng = typeof parsed.lng === 'number' ? parsed.lng : null
      if (lat === null || lng === null || isSentinelCoord(lat, lng)) {
        return { name: isAntarcticaName(name) ? '' : name, lat: null, lng: null }
      }
      return { name, lat, lng }
    } catch {
      return { name: '', lat: null, lng: null }
    }
  }
  if (trimmed.startsWith('"')) {
    try {
      const unquoted = JSON.parse(trimmed)
      const name = typeof unquoted === 'string' ? unquoted.trim() : ''
      return { name: isAntarcticaName(name) ? '' : name, lat: null, lng: null }
    } catch {}
  }
  return { name: isAntarcticaName(trimmed) ? '' : trimmed, lat: null, lng: null }
}

const LEGACY_LOCATION_COORDS = {
  'santa cruz, ca': { lat: 36.9741, lng: -122.0308 },
  'brownsville, texas, usa': { lat: 25.9018, lng: -97.4975 },
  'winter park, fl usa': { lat: 28.6, lng: -81.3392 },
  'charleston, sc': { lat: 32.7765, lng: -79.9311 },
  'austin, texas': { lat: 30.2672, lng: -97.7431 },
  'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
  'houston, texas': { lat: 29.7604, lng: -95.3698 },
  'raleigh, north carolina': { lat: 35.7796, lng: -78.6382 },
  'phoenix, usa': { lat: 33.4484, lng: -112.074 },
  'washington, d.c.': { lat: 38.9072, lng: -77.0369 },
  'washington, dc': { lat: 38.9072, lng: -77.0369 },
  'i live/ work between la serena, chile and taos, new mexico': { lat: -29.9027, lng: -71.2519 },
  'colorado springs, colorado, united states': { lat: 38.8339, lng: -104.8214 },
  'roatán, honduras': { lat: 16.3217, lng: -86.5366 },
  'prospera, roatan honduras': { lat: 16.4093, lng: -86.418 },
  'new jersey, usa': { lat: 40.0583, lng: -74.4057 },
  'baltimore county, maryland': { lat: 39.4432, lng: -76.6068 },
  'paris, france': { lat: 48.8566, lng: 2.3522 },
}

async function geocode(text) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${apiKey}`
  )
  const data = await res.json()
  const r = data?.results?.[0]
  if (r?.geometry?.location) {
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, name: r.formatted_address || text }
  }
  return { error: data?.status || 'no results' }
}

async function main() {
  const res = await fetch(
    "https://tableland.network/api/v1/query?statement=" +
      encodeURIComponent("SELECT id,name,location,view,image FROM CITIZENTABLE_42161_126")
  )
  const rows = await res.json()

  let geocoded = 0
  let alreadyHadCoords = 0
  let scattered = 0
  let excluded = 0
  const failures = []
  const scatteredNames = []

  for (const row of rows) {
    if (!row.view || !row.name || !row.image) {
      excluded++
      continue
    }
    // convertRow does JSON.stringify(row.location)
    const attrValue = JSON.stringify(row.location)
    const parsed = parseLocationData(attrValue)

    if (parsed.lat !== null && parsed.lng !== null) {
      alreadyHadCoords++
      continue
    }
    if (parsed.name) {
      const legacy = LEGACY_LOCATION_COORDS[parsed.name.trim().toLowerCase()]
      if (legacy) {
        geocoded++
        continue
      }
      const geo = await geocode(parsed.name)
      if (geo.error) {
        failures.push({ id: row.id, name: row.name, locationText: parsed.name, error: geo.error })
        scattered++
        scatteredNames.push(`${row.id} ${row.name} (geocode failed: ${parsed.name})`)
      } else {
        geocoded++
      }
    } else {
      scattered++
      scatteredNames.push(`${row.id} ${row.name} (no location)`)
    }
  }

  console.log(`total rows: ${rows.length}`)
  console.log(`excluded (deleted/unnamed/no image): ${excluded}`)
  console.log(`already had real coords: ${alreadyHadCoords}`)
  console.log(`geocoded successfully: ${geocoded}`)
  console.log(`scattered in Antarctica: ${scattered}`)
  console.log('\n--- scattered citizens ---')
  scatteredNames.forEach((n) => console.log(' ', n))
  if (failures.length) {
    console.log('\n--- geocode failures ---')
    failures.forEach((f) => console.log(' ', JSON.stringify(f)))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
