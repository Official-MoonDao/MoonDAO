import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN } from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import { initSDK } from '../thirdweb/thirdweb'
import { getAttribute } from '../utils/nft'

export async function getAllCitizenLocationData() {
  let citizensLocationData = []
  if (process.env.NEXT_PUBLIC_ENV === 'prod') {
    const sdk = initSDK(DEFAULT_CHAIN)

    const citizenContract = await sdk.getContract(
      CITIZEN_ADDRESSES[DEFAULT_CHAIN.slug],
      CitizenABI
    )

    const totalCitizens = await citizenContract.call('totalSupply')

    const citizens = [] //replace with citizenContract.erc721.getAll() if all citizens load
    for (let i = 0; i < totalCitizens.toNumber(); i++) {
      if (!blockedCitizens.includes(i)) {
        const citizen = await citizenContract.erc721.get(i)
        citizens.push(citizen)
      }
    }

    const filteredValidCitizens = citizens.filter(async (c: any) => {
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = await citizenContract.call('expiresAt', [c.metadata.id])
      const view = getAttribute(c.metadata.attributes, 'view').value
      return (
        expiresAt.toNumber() > now &&
        view === 'public' &&
        !blockedCitizens.includes(c.metadata.id)
      )
    })

    //Citizen location data for citizens w/ old location format
    const citizenCoordsRes = await fetch(
      `https://ipfs.io/ipfs/${process.env.CITIZEN_COORDS_IPFS_HASH}`
    )
    const citizenCoords = await citizenCoordsRes.json()

    //Get location data for each citizen
    for (const citizen of filteredValidCitizens) {
      const citizenLocation = getAttribute(
        citizen?.metadata?.attributes as any[],
        'location'
      ).value

      let locationData
      if (citizenLocation !== '' && !citizenLocation.startsWith('{')) {
        const citizenLocationData = citizenCoords.find(
          (c: any) => c.id === citizen.metadata.id
        )
        locationData = {
          results: [
            {
              formatted_address: citizenLocationData.name,
              geometry: {
                location: {
                  lat: citizenLocationData.lat,
                  lng: citizenLocationData.lng,
                },
              },
            },
          ],
        }
      } else if (citizenLocation.startsWith('{')) {
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
          locationData?.results?.[0]?.formatted_address || 'Antartica',
        image: citizen.metadata.image,
        lat: locationData?.results?.[0]?.geometry?.location?.lat || -90,
        lng: locationData?.results?.[0]?.geometry?.location?.lng || 0,
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
