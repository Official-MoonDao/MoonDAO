import CitizenABI from 'const/abis/Citizen.json'
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { getContract, NFT, readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { CitizenRow, citizenRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
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
  citizenLocationData,
}: {
  citizenLocationData: any
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
        title={'Map'}
        description={
          "Discover the global reach of the Space Acceleration Network on our interactive 3D map! Explore the locations of our citizens worldwide and see how we're connecting space enthusiasts across the planet."
        }
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
              <Earth pointsData={citizenLocationData} />
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
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      abi: CitizenABI as any,
      chain,
    })

    const citizens: NFT[] = []
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

  return {
    props: {
      citizenLocationData,
    },
    revalidate: 60,
  }
}
