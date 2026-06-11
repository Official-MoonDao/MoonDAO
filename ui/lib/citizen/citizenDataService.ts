/**
 * Centralized Citizen Data Service
 *
 * Single source of truth for fetching and validating citizen data with location information.
 * Uses batched RPC calls to efficiently check subscription status and avoid rate limiting.
 */
import CitizenABI from 'const/abis/Citizen.json'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import { CITIZEN_ADDRESSES, CITIZEN_TABLE_NAMES, CITIZEN_TABLE_ADDRESSES } from 'const/config'
import { BLOCKED_CITIZENS } from 'const/whitelist'
import { Chain, getContract, NFT, readContract } from 'thirdweb'
import { CitizenLocationData, GroupedLocationData } from '@/lib/network/types'
import { CitizenRow, citizenRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getAttribute } from '@/lib/utils/nft'

export type SubscriptionValidationResult = {
  id: string | number
  expiresAt: bigint
  isValid: boolean
}

/**
 * Batch check subscription expiration for multiple citizens
 * Uses Thirdweb Engine API for efficient multicall
 */
export async function batchCheckSubscriptions(
  citizenIds: Array<string | number>,
  citizenContractAddress: string,
  chainId: number,
  options: {
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Map<string | number, SubscriptionValidationResult>> {
  const { onProgress } = options
  const now = Math.floor(Date.now() / 1000)
  const resultMap = new Map<string | number, SubscriptionValidationResult>()

  if (citizenIds.length === 0) {
    return resultMap
  }

  try {
    onProgress?.(0, citizenIds.length)

    // Use Engine API for efficient multicall - single HTTP request
    const { engineBatchRead } = await import('@/lib/thirdweb/engine')
    const results = await engineBatchRead<string>(
      citizenContractAddress,
      'expiresAt',
      citizenIds.map((id) => [id]),
      CitizenABI,
      chainId
    )

    // Process results
    results.forEach((expiresAtHex, index) => {
      try {
        const id = citizenIds[index]
        const expiresAt = BigInt(expiresAtHex)
        const isValid = Number(expiresAt.toString()) > now

        resultMap.set(id, {
          id,
          expiresAt,
          isValid,
        })
      } catch (error) {
        console.warn(`Failed to parse subscription for citizen ${citizenIds[index]}:`, error)
      }
    })

    onProgress?.(citizenIds.length, citizenIds.length)
  } catch (error) {
    console.error('Failed to batch check subscriptions:', error)
  }

  return resultMap
}

/**
 * Scatter Antarctica-bound citizens across the continent so they don't
 * stack into a single tall column. Uses the citizen ID as a deterministic
 * seed so coordinates are stable across renders.
 *  - Latitude: -72° to -87° (kept close to the pole so points land on the
 *    continental landmass rather than the surrounding ocean)
 *  - Longitude: full -180° to +180°
 */
function scatterAntarctica(id: string | number): { lat: number; lng: number } {
  const n = Math.abs(Number(id) || 0)
  const lat = -72 - ((n * 7919) % 1500) / 100
  const lng = (((n * 6271) % 36000) / 100) - 180
  return { lat, lng }
}

type ParsedLocation = {
  // Human-readable place name ('' when there is no real location)
  name: string
  // Real coordinates, or null when none are stored
  lat: number | null
  lng: number | null
}

function isAntarcticaName(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return lower === 'antarctica' || lower === 'antartica'
}

// (0,0) is the geocode-failure fallback and sits in the ocean; (-90,0) is the
// legacy "no location" sentinel. Neither represents a real location.
function isSentinelCoord(lat: number, lng: number): boolean {
  return (lat === -90 && lng === 0) || (lat === 0 && lng === 0)
}

/**
 * Parse a citizen's stored location attribute into a place name and, when
 * available, real coordinates. Handles all three historical storage formats:
 *  - JSON object string: {"lat":..,"lng":..,"name":".."} (geocoded)
 *  - JSON-encoded plain string: "Austin, Texas" (legacy, name only)
 *  - raw plain text: Austin, Texas (legacy, name only)
 */
function parseLocationData(citizenLocation: string | undefined): ParsedLocation {
  if (!citizenLocation || citizenLocation.trim() === '') {
    return { name: '', lat: null, lng: null }
  }

  const trimmed = citizenLocation.trim()

  // Geocoded JSON object with coordinates
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''
      const lat = typeof parsed.lat === 'number' ? parsed.lat : null
      const lng = typeof parsed.lng === 'number' ? parsed.lng : null

      if (lat === null || lng === null || isSentinelCoord(lat, lng)) {
        // No usable coordinates — keep the name so we can geocode it later,
        // unless it's just the Antarctica placeholder
        return { name: isAntarcticaName(name) ? '' : name, lat: null, lng: null }
      }

      return { name, lat, lng }
    } catch (error) {
      console.error('Failed to parse location JSON:', error)
      return { name: '', lat: null, lng: null }
    }
  }

  // Legacy JSON-encoded plain string, e.g. '"Austin, Texas"'
  if (trimmed.startsWith('"')) {
    try {
      const unquoted = JSON.parse(trimmed)
      const name = typeof unquoted === 'string' ? unquoted.trim() : ''
      return { name: isAntarcticaName(name) ? '' : name, lat: null, lng: null }
    } catch {
      // Fall through to raw-text handling
    }
  }

  // Legacy raw plain text
  return { name: isAntarcticaName(trimmed) ? '' : trimmed, lat: null, lng: null }
}

// Cache geocode lookups across the request (and across ISR revalidations on a
// warm serverless instance) so we don't re-hit the Google API for the same
// place name on every map rebuild.
const geocodeCache = new Map<
  string,
  { lat: number; lng: number; name: string } | null
>()

/**
 * Geocode a plain-text place name server-side via the Google Maps API.
 * Returns null when the location can't be resolved or no API key is set.
 */
async function geocodeLocationText(
  text: string
): Promise<{ lat: number; lng: number; name: string } | null> {
  const key = text.trim().toLowerCase()
  if (key === '') return null
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    geocodeCache.set(key, null)
    return null
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        text
      )}&key=${apiKey}`
    )
    const data = await res.json()
    const result = data?.results?.[0]
    if (result?.geometry?.location) {
      const geo = {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        name: result.formatted_address || text,
      }
      geocodeCache.set(key, geo)
      return geo
    }
  } catch (error) {
    console.error(`Failed to geocode "${text}":`, error)
  }

  geocodeCache.set(key, null)
  return null
}

/**
 * Extract country from formatted address
 */
function extractCountryFromAddress(formattedAddress: string): string {
  if (!formattedAddress || formattedAddress === 'Antarctica') {
    return 'Antarctica'
  }

  const parts = formattedAddress.split(',').map((part) => part.trim())
  if (parts.length === 0) return 'Unknown'

  const country = parts[parts.length - 1]

  const countryMappings: { [key: string]: string } = {
    USA: 'United States',
    US: 'United States',
    UK: 'United Kingdom',
    UAE: 'United Arab Emirates',
  }

  return countryMappings[country] || country
}

/**
 * Group citizens by location coordinates
 */
function groupCitizensByLocation(
  citizensLocationData: CitizenLocationData[]
): GroupedLocationData[] {
  const locationMap = new Map<string, GroupedLocationData>()

  for (const citizen of citizensLocationData) {
    const key = `${citizen.lat},${citizen.lng}`

    if (!locationMap.has(key)) {
      locationMap.set(key, {
        citizens: [citizen],
        names: [citizen.name],
        formattedAddress: citizen.formattedAddress,
        lat: citizen.lat,
        lng: citizen.lng,
        color: '#5556eb',
        size: 0.01,
      })
    } else {
      const existing = locationMap.get(key)!
      existing.names.push(citizen.name)
      existing.citizens.push(citizen)
    }
  }

  // Calculate colors and sizes based on number of citizens at location
  return Array.from(locationMap.values()).map((entry) => ({
    ...entry,
    color:
      entry.citizens.length > 3 ? '#6a3d79' : entry.citizens.length > 1 ? '#5e4dbf' : '#5556eb',
    size: entry.citizens.length > 1 ? Math.min(entry.citizens.length * 0.01, 0.4) : 0.01,
  }))
}

/**
 * Fetch a single citizen by ID efficiently
 * Used for citizen profile pages to avoid querying all citizens
 */
export async function fetchCitizenById(
  chain: Chain,
  citizenId: string | number
): Promise<NFT | null> {
  const chainSlug = getChainSlug(chain)

  try {
    let citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]
    if (!citizenTableName && CITIZEN_TABLE_ADDRESSES[chainSlug]) {
      const citizenTableContract = getContract({
        client: serverClient,
        address: CITIZEN_TABLE_ADDRESSES[chainSlug],
        chain,
        abi: CitizenTableABI as any,
      })
      citizenTableName = (await readContract({
        contract: citizenTableContract,
        method: 'getTableName',
      })) as string
    }

    if (!citizenTableName) {
      console.error('Citizen table name not found')
      return null
    }

    const citizenStatement = `SELECT * FROM ${citizenTableName} WHERE id = ${citizenId}`
    const citizenRows: any = await queryTable(chain, citizenStatement)

    if (!citizenRows || citizenRows.length === 0 || BLOCKED_CITIZENS.has(Number(citizenId))) {
      return null
    }

    const citizen = citizenRowToNFT(citizenRows[0] as CitizenRow)
    return citizen
  } catch (error) {
    console.error(`Error fetching citizen ${citizenId}:`, error)
    return null
  }
}

/**
 * Main entry point: Fetch all citizens with location data and valid subscriptions
 * This is the single source of truth for citizen location data
 */
export async function fetchCitizensWithLocation(
  chain: Chain,
  options: {
    onProgress?: (step: string, completed: number, total: number) => void
  } = {}
): Promise<GroupedLocationData[]> {
  const { onProgress } = options

  try {
    const chainSlug = getChainSlug(chain)

    onProgress?.('Fetching citizen table name', 0, 5)

    // Get citizen table name
    let citizenTableName = CITIZEN_TABLE_NAMES[chainSlug]
    if (!citizenTableName && CITIZEN_TABLE_ADDRESSES[chainSlug]) {
      const citizenTableContract = getContract({
        client: serverClient,
        address: CITIZEN_TABLE_ADDRESSES[chainSlug],
        chain,
        abi: CitizenTableABI as any,
      })
      citizenTableName = (await readContract({
        contract: citizenTableContract,
        method: 'getTableName',
      })) as string
    }

    if (!citizenTableName) {
      console.error('Citizen table name not found')
      return []
    }

    onProgress?.('Querying citizen table', 1, 5)

    // Fetch all citizens from tableland, excluding deleted/blank profiles:
    // view='' means profile was deleted; name='' or image='' means incomplete/broken profile
    const citizenStatement = `SELECT * FROM ${citizenTableName} WHERE view != '' AND name != '' AND image != ''`
    const citizenRows: any = await queryTable(chain, citizenStatement)

    if (!citizenRows || citizenRows.length === 0) {
      return []
    }

    onProgress?.('Converting citizen data', 2, 5)

    // Convert rows to NFTs and filter blocked citizens
    const citizens: NFT[] = []
    for (const row of citizenRows) {
      if (!BLOCKED_CITIZENS.has(row.id)) {
        try {
          citizens.push(citizenRowToNFT(row as CitizenRow))
        } catch (error) {
          console.error(`Failed to convert citizen row ${row.id}:`, error)
        }
      }
    }

    if (citizens.length === 0) {
      return []
    }

    onProgress?.('Validating subscriptions', 3, 5)

    // Get citizen contract
    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      abi: CitizenABI as any,
      chain,
    })

    // Batch validate subscriptions using Engine API
    const citizenIds = citizens.map((c: any) => c.metadata.id)

    onProgress?.('Processing location data', 4, 5)

    // Filter valid citizens and build location data
    const citizensLocationData: CitizenLocationData[] = []

    for (const citizen of citizens) {
      const citizenId = (citizen as any).metadata.id

      const citizenLocation = getAttribute(
        (citizen as any).metadata?.attributes as unknown as any[],
        'location'
      )?.value

      const parsed = parseLocationData(citizenLocation)

      let lat = parsed.lat
      let lng = parsed.lng
      let formattedAddress = parsed.name || 'Antarctica'

      // Legacy citizens stored their location as plain text with no
      // coordinates. Geocode the name so they show up in the right place
      // instead of being dumped at the South Pole.
      if ((lat === null || lng === null) && parsed.name) {
        const geo = await geocodeLocationText(parsed.name)
        if (geo) {
          lat = geo.lat
          lng = geo.lng
          formattedAddress = geo.name
        }
      }

      // Still no usable coordinates — scatter across Antarctica so citizens
      // with no real location don't stack into a single tall column
      if (lat === null || lng === null) {
        const scattered = scatterAntarctica(citizenId)
        lat = scattered.lat
        lng = scattered.lng
        formattedAddress = parsed.name || 'Antarctica'
      }

      citizensLocationData.push({
        id: citizenId,
        name: (citizen as any).metadata.name,
        location: citizenLocation || '',
        formattedAddress,
        image: (citizen as any).metadata.image,
        lat,
        lng,
      })
    }

    onProgress?.('Grouping by location', 5, 5)

    // Group citizens by location
    const groupedData = groupCitizensByLocation(citizensLocationData)

    return groupedData
  } catch (error) {
    console.error('Error fetching citizens with location:', error)
    return []
  }
}

/**
 * Get dummy data for development/testing
 */
export function getDummyCitizenLocationData(): GroupedLocationData[] {
  return [
    {
      citizens: [
        {
          id: '1',
          name: 'Ryan',
          location: '',
          formattedAddress: 'Antarctica',
          image:
            'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e/',
          lat: -90,
          lng: 0,
        },
        {
          id: '2',
          name: 'name.get',
          location: 'Earth',
          formattedAddress: 'Antarctica',
          image:
            'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
          lat: -90,
          lng: 0,
        },
      ],
      names: ['Ryan', 'name.get'],
      formattedAddress: 'Antarctica',
      lat: -90,
      lng: 0,
      color: '#5e4dbf',
      size: 0.02,
    },
  ]
}
