import { XMarkIcon } from '@heroicons/react/24/outline'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN } from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import { getAttribute } from '@/lib/utils/nft'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import Head from '@/components/layout/Head'
import Modal from '@/components/layout/Modal'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Tab from '@/components/layout/Tab'
import MOON_LANDINGS from '../public/react-globe/moon_landings.json'

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false })

function useGlobeSize() {
  const [size, setSize] = useState({ width: 500, height: 500 })
  useEffect(() => {
    let width, height
    if (window?.innerWidth > 1000) {
      width = 1000
    } else if (window?.innerWidth > 500) {
      width = window.innerWidth * 0.6
    } else {
      width = window.innerWidth * 0.8
    }
    height = width
    setSize({ width, height })
  }, [])
  return size
}

function PointLabel({ formattedAddress, name, citizens }: any) {
  return (
    <div className="hidden md:block absolute w-[50vw] h-[50vh] max-w-[500px] z-[100]">
      <p className="font-bold text-2xl break-words max-w-[200px]">
        {formattedAddress}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {citizens.map((c: any) => (
          <div key={c.id} className="flex flex-col items-center">
            <img
              className="rounded-full"
              src={c.image}
              alt={c.name}
              width={75}
              height={75}
            />
            <p className="w-[50px]">
              {c.name.length > 10 ? c.name.slice(0, 10) + '...' : c.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PointModal({ selectedPoint, setEnabled }: any) {
  return (
    <Modal id="point-modal" setEnabled={setEnabled}>
      <div className="w-full rounded-[2vmax] flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5  bg-dark-cool h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes max-w-[200px] md:max-w-none">
              {selectedPoint?.formattedAddress}
            </h2>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="p-2 grid grid-cols-3 md:grid-cols-5 gap-4 overflow-y-scroll max-h-[80vh]">
          {selectedPoint?.citizens.map((c: any) => (
            <Link
              className="hover:underline hover:scale-105 transition-all duration-300"
              href={`/citizen/${c.id}`}
              key={c.id}
              passHref
            >
              <div className="flex flex-col items-center">
                <img
                  className="rounded-full"
                  src={c.image}
                  alt={c.name}
                  width={75}
                  height={75}
                />
                <p className="w-[75px] text-center break-words">{c.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function Moon() {
  const size = useGlobeSize()

  return (
    <Globe
      width={size.width}
      height={size.height}
      backgroundColor="#00000000"
      globeImageUrl={'/react-globe/lunar_surface.jpg'}
      bumpImageUrl={'/react-globe/lunar_bumpmap.jpg'}
      showGraticules={false}
      showAtmosphere={false}
      labelText="label"
      labelSize={1.25}
      labelDotRadius={0.4}
      labelsData={MOON_LANDINGS}
      labelColor="#000000"
      animateIn
    />
  )
}

function Earth({ pointsData }: any) {
  const size = useGlobeSize()

  const [selectedPoint, setSelectedPoint] = useState(null)
  const [pointModalEnabled, setPointModalEnabled] = useState(false)

  return (
    <>
      <Globe
        width={size.width}
        height={size.height}
        backgroundColor="#00000000"
        globeImageUrl={
          'https://unpkg.com/three-globe@2.33.0/example/img/earth-night.jpg'
        }
        pointsData={pointsData}
        pointAltitude="size"
        pointColor="color"
        pointRadius={0.5}
        labelSize={1.7}
        pointLabel={(d: any) =>
          ReactDOMServer.renderToString(
            <PointLabel
              formattedAddress={d.formattedAddress}
              name={d.name}
              citizens={d.citizens}
            />
          )
        }
        onPointClick={(d: any) => {
          setSelectedPoint(d)
          setPointModalEnabled(true)
        }}
        animateIn
      />
      {pointModalEnabled && (
        <PointModal
          selectedPoint={selectedPoint}
          setEnabled={setPointModalEnabled}
        />
      )}
    </>
  )
}

export default function NetworkMap({
  citizensLocationData,
}: {
  citizensLocationData: any
}) {
  const [tab, setTab] = useState('earth')

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-4">
        Explore the network map and discover moon landings!
      </div>
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
    </div>
  )

  return (
    <section id="map-container" className="overflow-hidden">
      <Head title="Map" />
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
          <div className="w-full flex justify-center items-center z-[100] min-h-[50vh] p-2 bg-dark-cool">
            <div className={`${tab !== 'earth' && 'hidden'}`}>
              <Earth pointsData={citizensLocationData} />
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
  const sdk = initSDK(DEFAULT_CHAIN)

  const citizenContract = await sdk.getContract(
    CITIZEN_ADDRESSES[DEFAULT_CHAIN.slug]
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

  let citizensLocationData = []

  //Get location data for each citizen
  for (const citizen of filteredValidCitizens) {
    const citizenLocation = getAttribute(
      citizen?.metadata?.attributes as any[],
      'location'
    ).value

    let locationData
    if (citizenLocation !== '') {
      const locationRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${citizenLocation}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      )
      locationData = await locationRes.json()
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
  citizensLocationData = Array.from(locationMap.values()).map((entry) => ({
    ...entry,
    color: entry.citizens.length > 1 ? '#6d3f79' : '#3142a2', // Concatenate names with line breaks
    size:
      entry.citizens.length > 1
        ? Math.min(entry.citizens.length * 0.01, 0.4)
        : 0.01,
  }))

  return {
    props: {
      citizensLocationData,
    },
    revalidate: 600,
  }
}
