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
 * Parse location data from citizen attributes
 */
function parseLocationData(citizenLocation: string | undefined): {
  formattedAddress: string
  lat: number
  lng: number
} {
  if (!citizenLocation || citizenLocation.trim() === '') {
    return {
      formattedAddress: 'Antarctica',
      lat: -90,
      lng: 0,
    }
  }

  // Handle JSON format location
  if (citizenLocation.startsWith('{')) {
    try {
      const parsedLocationData = JSON.parse(citizenLocation)
      const locationName = parsedLocationData.name?.trim() || ''

      return {
        formattedAddress: locationName === '' ? 'Antarctica' : locationName,
        lat: parsedLocationData.lat || -90,
        lng: parsedLocationData.lng || 0,
      }
    } catch (error) {
      console.error('Failed to parse location JSON:', error)
      return {
        formattedAddress: 'Antarctica',
        lat: -90,
        lng: 0,
      }
    }
  }

  // Handle plain text location (no geocoding, just use the text)
  const trimmedLocation = citizenLocation.trim()
  return {
    formattedAddress: trimmedLocation === '' ? 'Antarctica' : trimmedLocation,
    lat: -90, // Default to Antarctica if no coordinates
    lng: 0,
  }
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

    // Fetch all citizens from tableland
    const citizenStatement = `SELECT * FROM ${citizenTableName}`
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
    const validationResults = await batchCheckSubscriptions(
      citizenIds,
      citizenContract.address,
      chain.id,
      {
        onProgress: (completed, total) => {
          onProgress?.('Validating subscriptions', 3, 5)
        },
      }
    )

    onProgress?.('Processing location data', 4, 5)

    // Filter valid citizens and build location data
    const citizensLocationData: CitizenLocationData[] = []

    for (const citizen of citizens) {
      const citizenId = (citizen as any).metadata.id
      const validation = validationResults.get(citizenId)

      // Skip invalid subscriptions
      if (!validation || !validation.isValid) {
        continue
      }

      const citizenLocation = getAttribute(
        (citizen as any).metadata?.attributes as unknown as any[],
        'location'
      )?.value

      const locationData = parseLocationData(citizenLocation)

      citizensLocationData.push({
        id: citizenId,
        name: (citizen as any).metadata.name,
        location: citizenLocation || '',
        formattedAddress: locationData.formattedAddress,
        image: (citizen as any).metadata.image,
        lat: locationData.lat,
        lng: locationData.lng,
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
