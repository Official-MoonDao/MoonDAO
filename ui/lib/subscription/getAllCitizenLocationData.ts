//server-side only
import CitizenABI from 'const/abis/Citizen.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import { getContract, readContract } from 'thirdweb'
import { CitizenRow, citizenRowToNFT } from '../tableland/convertRow'
import queryTable from '../tableland/queryTable'
import { getChainSlug } from '../thirdweb/chain'
import { serverClient } from '../thirdweb/client'
import { getAttribute } from '../utils/nft'

export async function getAllCitizenLocationData() {
  let citizensLocationData = []
  if (process.env.NEXT_PUBLIC_ENV === 'prod') {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      abi: CitizenABI as any,
      chain,
    })

    const citizens = []
    const citizenStatement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}`
    const citizenRows = await queryTable(chain, citizenStatement)

    for (const citizen of citizenRows) {
      citizens.push(citizenRowToNFT(citizen as CitizenRow))
    }

    const filteredValidCitizens = citizens.filter(async (c: any) => {
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = await readContract({
        contract: citizenContract,
        method: 'expiresAt',
        params: [c.metadata.id],
      })
      const view = getAttribute(c?.metadata?.attributes, 'view')?.value
      return (
        +expiresAt.toString() > now &&
        view === 'public' &&
        !blockedCitizens.includes(c.metadata.id)
      )
    })

    //Get location data for each citizen
    for (const citizen of filteredValidCitizens) {
      const citizenLocation = JSON.stringify(
        getAttribute(
          citizen?.metadata?.attributes as unknown as any[],
          'location'
        )?.value
      )

      let locationData

      if (
        citizenLocation &&
        citizenLocation !== '' &&
        !citizenLocation?.startsWith('{')
      ) {
        const locationRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${citizenLocation}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        )
        locationData = await locationRes.json()
      } else if (citizenLocation?.startsWith('{')) {
        const parsedLocationData = JSON.parse(citizenLocation)
        locationData = {
          results: [
            {
              formatted_address: parsedLocationData.name,
              geometry: {
                location: {
                  lat: parsedLocationData.lat,
                  lng: parsedLocationData.lng,
                },
              },
            },
          ],
        }
      } else {
        locationData = {
          results: [
            {
              formatted_address: 'Antartica',
              geometry: { location: { lat: -90, lng: 0 } },
            },
          ],
        }
      }

      citizensLocationData.push({
        id: citizen.metadata.id,
        name: citizen.metadata.name,
        location: citizenLocation,
        formattedAddress:
          locationData.results?.[0]?.formatted_address || 'Antartica',
        image: citizen.metadata.image,
        lat: locationData.results?.[0]?.geometry?.location?.lat || -90,
        lng: locationData.results?.[0]?.geometry?.location?.lng || 0,
      })
    }

    // Group citizens by lat and lng
    const locationMap = new Map()

    for (const citizen of citizensLocationData) {
      const key = `${citizen.lat},${citizen.lng}`
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          citizens: [citizen],
          names: [citizen.name],
          formattedAddress: citizen.formattedAddress,
          lat: citizen.lat,
          lng: citizen.lng, // Add formattedAddress as the first element
        })
      } else {
        const existing = locationMap.get(key)
        existing.names.push(citizen.name)
        existing.citizens.push(citizen)
      }
    }

    // Convert the map back to an array
    citizensLocationData = Array.from(locationMap.values()).map(
      (entry: any) => ({
        ...entry,
        color:
          entry.citizens.length > 3
            ? '#6a3d79'
            : entry.citizens.length > 1
            ? '#5e4dbf'
            : '#5556eb',
        size:
          entry.citizens.length > 1
            ? Math.min(entry.citizens.length * 0.01, 0.4)
            : 0.01,
      })
    )
  } else {
    citizensLocationData = dummyData
  }

  return citizensLocationData
}

export const dummyData = [
  {
    citizens: [
      {
        id: '1',
        name: 'Ryan',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e/',
        lat: -90,
        lng: 0,
        prettyLink: 'ryan-1',
      },
    ],
    formattedAddress: 'Antartica',
    lat: -90,
    lng: 0,
    color: '#5556eb',
    size: 0.01,
    names: ['Ryan'],
  },
  // Add more points around the globe for visual interest
  {
    citizens: [
      {
        id: '2',
        name: 'MoonDAO SF',
        location: 'San Francisco',
        formattedAddress: 'San Francisco, CA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
        lat: 37.7749,
        lng: -122.4194,
        prettyLink: 'moondao-sf',
      },
    ],
    formattedAddress: 'San Francisco, CA',
    lat: 37.7749,
    lng: -122.4194,
    color: '#5556eb',
    size: 0.01,
    names: ['MoonDAO SF'],
  },
  // Add more locations as needed
]
