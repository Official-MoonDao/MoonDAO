import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN } from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { getAttribute } from '@/lib/utils/nft'
import IconOrg from '@/components/assets/IconOrg'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import Tab from '@/components/layout/Tab'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })
const Moon = dynamic(() => import('@/components/globe/Moon'), { ssr: false })

export default function NetworkMap({
  citizensLocationData,
}: {
  citizensLocationData: any
}) {
  const router = useRouter()

  const [tab, setTab] = useState('earth')

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">
        Explore the network map and discover moon landings!
      </div>
      <div className="flex gap-4">
        <Frame className="w-[300px]" noPadding>
          <div className="flex flex-wrap text-sm bg-filter">
            <Tab tab="earth" setTab={setTab} currentTab={tab}>
              Earth
            </Tab>
            <Tab tab="moon" setTab={setTab} currentTab={tab}>
              Moon
            </Tab>
          </div>
        </Frame>
        <StandardButton
          className="gradient-2"
          onClick={() => router.push('/network')}
        >
          <IconOrg />
        </StandardButton>
      </div>
    </div>
  )

  return (
    <section id="map-container" className="overflow-hidden">
      <Head
        title="Map"
        image="https://ipfs.io/ipfs/Qmc1FsD9pCw3FoYEQ1zviqXc3DQddyxte6cQ8hv6EvukFr"
      />
      <Container>
        <ContentLayout
          header="Map"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="w-full md:w-auto inline-block md:mr-12 rounded-lg z-[100] min-h-[50vh] overflow-hidden">
            <div
              className={`flex items-center justify-center ${
                tab !== 'earth' && 'hidden'
              }`}
            >
              <Earth pointsData={citizensLocationData} enableControls={false} fixedView={true} />
            </div>
            <div className={`${tab !== 'moon' && 'hidden'}`}>
              <Moon />
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
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

    //Get location data for each citizen
    for (const citizen of filteredValidCitizens) {
      const citizenLocation = getAttribute(
        citizen?.metadata?.attributes as any[],
        'location'
      ).value

      let locationData
      if (citizenLocation !== '' && !citizenLocation.startsWith('{')) {
        const locationRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${citizenLocation}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        )
        locationData = await locationRes.json()
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

  return {
    props: {
      citizensLocationData,
    },
    revalidate: 600,
  }
}

export const dummyData = [
  {
    citizens: [
      {
        id: '1',
        name: 'Ryan',
        location: '',
        formattedAddress: 'Antartica',
        image: 'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifh2vwvfxfy6fevqkirldplgp47sfblcfvhn7nsxo4z4krsuulf2e/',
        lat: -90,
        lng: 0,
        prettyLink: 'ryan-1',
      }
    ],
    formattedAddress: 'Antartica',
    lat: -90,
    lng: 0,
    color: '#5556eb',
    size: 0.01,
    names: ['Ryan']
  },
  // Add more points around the globe for visual interest
  {
    citizens: [
      {
        id: '2',
        name: 'MoonDAO SF',
        location: 'San Francisco',
        formattedAddress: 'San Francisco, CA',
        image: 'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
        lat: 37.7749,
        lng: -122.4194,
        prettyLink: 'moondao-sf'
      }
    ],
    formattedAddress: 'San Francisco, CA',
    lat: 37.7749,
    lng: -122.4194,
    color: '#5556eb',
    size: 0.01,
    names: ['MoonDAO SF']
  },
  // Add more locations as needed
]
