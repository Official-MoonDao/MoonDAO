import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, CITIZEN_TABLE_NAMES } from 'const/config'
import { BLOCKED_CITIZENS } from 'const/whitelist'
import { getContract, NFT, readContract } from 'thirdweb'
import { arbitrum } from '@/lib/infura/infuraChains'
import { CitizenRow, citizenRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getAttribute } from '@/lib/utils/nft'

// Function to extract country from formatted address
function extractCountryFromAddress(formattedAddress: string): string {
  if (!formattedAddress) return 'Unknown'

  // Handle special case of Antarctica
  if (formattedAddress === 'Antarctica') return 'Antarctica'

  // Split by comma and get the last part, which is typically the country
  const parts = formattedAddress.split(',').map((part) => part.trim())
  if (parts.length === 0) return 'Unknown'

  // Return the last part as the country
  const country = parts[parts.length - 1]

  // Handle common country code mappings
  const countryMappings: { [key: string]: string } = {
    USA: 'United States',
    US: 'United States',
    UK: 'United Kingdom',
    UAE: 'United Arab Emirates',
  }

  return countryMappings[country] || country
}

export async function getCitizensLocationData() {
  try {
    let citizensLocationData = []

    if (
      process.env.NEXT_PUBLIC_ENV === 'prod' ||
      process.env.NEXT_PUBLIC_TEST_ENV === 'true'
    ) {
      const chain = arbitrum
      const chainSlug = getChainSlug(chain)

      const citizenContract = getContract({
        client: serverClient,
        address: CITIZEN_ADDRESSES[chainSlug],
        abi: CitizenABI as any,
        chain,
      })

      const citizens: NFT[] = []
      const citizenStatement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}`
      const citizenRows: any = await queryTable(chain, citizenStatement)

      for (const citizen of citizenRows) {
        if (!BLOCKED_CITIZENS.has(citizen.id))
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
          !BLOCKED_CITIZENS.has(c.metadata.id)
        )
      })

      // Get location data for each citizen
      for (const citizen of filteredValidCitizens) {
        const citizenLocation = getAttribute(
          citizen?.metadata?.attributes as unknown as any[],
          'location'
        )?.value

        let locationData

        if (
          citizenLocation &&
          citizenLocation !== '' &&
          !citizenLocation?.startsWith('{')
        ) {
          locationData = {
            results: [
              {
                formatted_address: citizenLocation,
              },
            ],
          }
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
                formatted_address: 'Antarctica',
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
            locationData.results?.[0]?.formatted_address || 'Antarctica',
          country: extractCountryFromAddress(
            locationData.results?.[0]?.formatted_address || 'Antarctica'
          ),
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
            country: citizen.country,
            lat: citizen.lat,
            lng: citizen.lng,
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
      citizensLocationData = getDummyData()
    }

    return citizensLocationData
  } catch (error) {
    console.error('Error getting citizens location data:', error)
    return []
  }
}

function getDummyData() {
  return [
    {
      citizens: [
        {
          id: '1',
          name: 'Ryan',
          location: '',
          formattedAddress: 'Antarctica',
          country: 'Antarctica',
          image:
            'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e/',
          lat: -90,
          lng: 0,
          prettyLink: 'ryan-1',
        },
        {
          id: '2',
          name: 'name.get',
          location: 'Earth',
          formattedAddress: 'Antarctica',
          country: 'Antarctica',
          image:
            'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
          lat: -90,
          lng: 0,
          prettyLink: 'name.get-2',
        },
      ],
      formattedAddress: 'Antarctica',
      country: 'Antarctica',
      lat: -90,
      lng: 0,
      color: '#5e4dbf',
      size: 0.25,
      __threeObj: {
        metadata: {
          version: 4.6,
          type: 'Object',
          generator: 'Object3D.toJSON',
        },
        geometries: [
          {
            uuid: '7e55f1cb-1786-4ead-a9a3-3a92bff0065f',
            type: 'CylinderGeometry',
            radiusTop: 1,
            radiusBottom: 1,
            height: 1,
            radialSegments: 12,
            heightSegments: 1,
            openEnded: false,
            thetaStart: 0,
            thetaLength: 6.283185307179586,
          },
        ],
        materials: [
          {
            uuid: '32e00fa5-5a98-40bf-96cb-87f177a1e1f2',
            type: 'MeshLambertMaterial',
            color: 7159673,
            emissive: 0,
            envMapRotation: [0, 0, 0, 'XYZ'],
            reflectivity: 1,
            refractionRatio: 0.98,
            blendColor: 0,
          },
        ],
        object: {
          uuid: 'fa1437ae-f457-4a04-8532-7cc914681cc7',
          type: 'Mesh',
          layers: 1,
          matrix: [
            -0.8726646259971648, 5.378210990769368e-33, 6.850820741191227e-17,
            0, 6.850820741191227e-17, 1.9377047211159066e-16,
            0.8726646259971648, 0, -1.5407439555097887e-31, 25,
            -5.551115123125783e-15, 0, 7.4987989133092885e-31, -100,
            1.2246467991473532e-14, 1,
          ],
          up: [0, 1, 0],
          geometry: '7e55f1cb-1786-4ead-a9a3-3a92bff0065f',
          material: '32e00fa5-5a98-40bf-96cb-87f177a1e1f2',
        },
      },
    },
  ]
}
