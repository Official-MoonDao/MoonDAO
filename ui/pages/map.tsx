import { XMarkIcon } from '@heroicons/react/24/outline'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN } from 'const/config'
import { blockedCitizens } from 'const/whitelist'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { forwardRef, useEffect, useRef, useState } from 'react'
import ReactDOMServer from 'react-dom/server'
import { GlobeProps } from 'react-globe.gl'
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

export default function Map({
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
  // const sdk = initSDK(DEFAULT_CHAIN)

  // const citizenContract = await sdk.getContract(
  //   CITIZEN_ADDRESSES[DEFAULT_CHAIN.slug]
  // )

  // const totalCitizens = await citizenContract.call('totalSupply')

  // const citizens = [] //replace with citizenContract.erc721.getAll() if all citizens load
  // for (let i = 0; i < totalCitizens.toNumber(); i++) {
  //   if (!blockedCitizens.includes(i)) {
  //     const citizen = await citizenContract.erc721.get(i)
  //     citizens.push(citizen)
  //   }
  // }

  // const filteredValidCitizens = citizens.filter(async (c: any) => {
  //   const now = Math.floor(Date.now() / 1000)
  //   const expiresAt = await citizenContract.call('expiresAt', [c.metadata.id])
  //   const view = getAttribute(c.metadata.attributes, 'view').value
  //   return (
  //     expiresAt.toNumber() > now &&
  //     view === 'public' &&
  //     !blockedCitizens.includes(c.metadata.id)
  //   )
  // })

  // let citizensLocationData = []

  // //Get location data for each citizen
  // for (const citizen of filteredValidCitizens) {
  //   const citizenLocation = getAttribute(
  //     citizen?.metadata?.attributes as any[],
  //     'location'
  //   ).value

  //   let locationData
  //   if (citizenLocation !== '') {
  //     const locationRes = await fetch(
  //       `https://maps.googleapis.com/maps/api/geocode/json?address=${citizenLocation}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  //     )
  //     locationData = await locationRes.json()
  //   } else {
  //     locationData = {
  //       results: [
  //         {
  //           formatted_address: 'Antartica',
  //           geometry: { location: { lat: -90, lng: 0 } },
  //         },
  //       ],
  //     }
  //   }

  //   citizensLocationData.push({
  //     id: citizen.metadata.id,
  //     name: citizen.metadata.name,
  //     location: citizenLocation,
  //     formattedAddress:
  //       locationData.results?.[0]?.formatted_address || 'Antartica',
  //     image: citizen.metadata.image,
  //     lat: locationData.results?.[0]?.geometry?.location?.lat || -90,
  //     lng: locationData.results?.[0]?.geometry?.location?.lng || 0,
  //   })
  // }

  // // Group citizens by lat and lng
  // const locationMap = new Map()

  // for (const citizen of citizensLocationData) {
  //   const key = `${citizen.lat},${citizen.lng}`
  //   if (!locationMap.has(key)) {
  //     locationMap.set(key, {
  //       citizens: [citizen],
  //       names: [citizen.name],
  //       formattedAddress: citizen.formattedAddress,
  //       lat: citizen.lat,
  //       lng: citizen.lng, // Add formattedAddress as the first element
  //     })
  //   } else {
  //     const existing = locationMap.get(key)
  //     existing.names.push(citizen.name)
  //     existing.citizens.push(citizen)
  //   }
  // }

  // // Convert the map back to an array
  // citizensLocationData = Array.from(locationMap.values()).map((entry) => ({
  //   ...entry,
  //   color: entry.citizens.length > 1 ? '#6d3f79' : '#3142a2', // Concatenate names with line breaks
  //   size:
  //     entry.citizens.length > 1
  //       ? Math.min(entry.citizens.length * 0.01, 0.4)
  //       : 0.01,
  // }))

  return {
    props: {
      citizensLocationData: dummyData,
    },
    revalidate: 600,
  }
}

const dummyData = [
  {
    citizens: [
      {
        id: '0',
        name: 'Mitchie',
        location: 'Montreal, Quebec, Canada',
        formattedAddress: 'Montreal, QC, Canada',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeicqt6czxfgmsoshrp4mi32bhxelg55c4jlcr7akfbvuiezg5zgwe4/',
        lat: 45.5018869,
        lng: -73.56739189999999,
      },
    ],
    names: ['Mitchie'],
    formattedAddress: 'Montreal, QC, Canada',
    lat: 45.5018869,
    lng: -73.56739189999999,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '0b08b24b-2ae8-457a-821a-2e10268911f9',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.24686580497063276, -4.8442618027897664e-17, -0.8370190104191018, 0,
          0.5970235055312725, 0.6116382224587755, -0.17608284452890757, 0,
          0.6048422377224175, -0.6417457841911012, -0.1783888586004997, 0,
          -67.22567869630167, 71.32735315442096, 19.82717367165898, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
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
      },
      {
        id: '2',
        name: 'name.get',
        location: 'Earth',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibo5na6nkatvor7bqisybzwtmh5n4l4wuws3uiyoqvjuuqwzwobna/',
        lat: -90,
        lng: 0,
      },
      {
        id: '5',
        name: 'lrcpunk',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeigwgpti4bpr6ynasumfhb2m6elcqfmzezpexhmudbsmsscneqhada/',
        lat: -90,
        lng: 0,
      },
      {
        id: '6',
        name: 'Philip Linden',
        location: 'Earth',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifuepl3ugeraqhezvhaqvv4wfr7xgauwn7dq64yx74j3hk56kzjbm/',
        lat: -90,
        lng: 0,
      },
      {
        id: '9',
        name: 'Anastasia',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeid3zobxm5ctfwdprcr4pd34brcnkt5haj6iez7ep2oqfopj22gyua/',
        lat: -90,
        lng: 0,
      },
      {
        id: '11',
        name: 'Lakshmi',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeierlhuixnk7dslfrlg5o2klxhesjbv3uoozx6neyiwfe7jgm6sc7e/',
        lat: -90,
        lng: 0,
      },
      {
        id: '14',
        name: 'Andrew C',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeih3m2vvvtzsgjzutrgcc6ut2sk5jizrfr2xbhohsrtk25vqf7riii/',
        lat: -90,
        lng: 0,
      },
      {
        id: '21',
        name: 'zwellstronaut',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeieikod6jsg4un2dz33j5o6oegiamivqgra3wpcthwgfqcvuldmvqa/',
        lat: -90,
        lng: 0,
      },
      {
        id: '25',
        name: 'Jango',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeie5ib5vgj2glwwmj3few2qnlkdgzkn2sacyudjjlo6ej6zxrmhkw4/',
        lat: -90,
        lng: 0,
      },
      {
        id: '27',
        name: 'jigglyjams',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiaor433wxpym2rlno2ln2joduw3hd6dpqk7f77be5n5ylpumyncla/',
        lat: -90,
        lng: 0,
      },
      {
        id: '29',
        name: 'pipilu',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeidh3pmpvrewycyaqairpjplffnm2ho2w7vnthrywlbenwsa53mfbi/',
        lat: -90,
        lng: 0,
      },
      {
        id: '30',
        name: 'wninny',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifetdk64uaahesyzzpmyl5apxhj5gifefg3e3b3zd2oilkzi7bj3a/',
        lat: -90,
        lng: 0,
      },
      {
        id: '32',
        name: 'Eliza Maria',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifatuembdgqjby7ig43f7mrapevumxlkvf5ziww3vrcy6zbnomn2a/',
        lat: -90,
        lng: 0,
      },
      {
        id: '34',
        name: 'Gohu',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeic2qmhz3nnnj3v5l3xpvf6vzdw4drlhplma7joinvn72wjp4dtpou/',
        lat: -90,
        lng: 0,
      },
      {
        id: '35',
        name: 'Amy',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeigd6qdfqs4n6f6cg4qty3knlzmwgjdwb74acqiiguoj4oado2qyaa/',
        lat: -90,
        lng: 0,
      },
      {
        id: '36',
        name: 'Mind4u2cn',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeia75u542m7s34tmh3wg2fnlnz4mh3c7qe67dbbeal2xoudhjvyv7a/',
        lat: -90,
        lng: 0,
      },
      {
        id: '37',
        name: 'Mohit Singh',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeidrpjcztmful27ygikqyrjypmc3osrsjd6mofz6kv23gv5hhufsfy/',
        lat: -90,
        lng: 0,
      },
      {
        id: '38',
        name: 'coffee-crusher',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiftlmklybzr3wjptwjy7lcz6kaitgazddusanb2tybhkb3zd3h7i4/',
        lat: -90,
        lng: 0,
      },
      {
        id: '40',
        name: 'justinpark01',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiaufyi4bllzkslpcls2lgdo2g5idqj56emo374pvn3ppkqmrpgj54/',
        lat: -90,
        lng: 0,
      },
      {
        id: '41',
        name: 'Sophia Stewart',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibns2okprxowssma7dsgjvh34x2h4wmmogfgar4iniytfljhkrjoa/',
        lat: -90,
        lng: 0,
      },
      {
        id: '42',
        name: 'Allen Hall',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeigyhju3cy57wgf4viubdkghqjrmlcmkdgsbpkp43al77zlyuscnmq/',
        lat: -90,
        lng: 0,
      },
      {
        id: '43',
        name: 'Frankzhu',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifthvgqqydarnw5yhrn7ktca4s7fd2qijzujpnxcc2a5z6hoa4v24/',
        lat: -90,
        lng: 0,
      },
      {
        id: '44',
        name: 'Hunter',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifdlzu6akimz7hto3k7drqzp3hq5xtz7pnazzuudymvsehxssaqj4/',
        lat: -90,
        lng: 0,
      },
      {
        id: '45',
        name: 'Amanda Nguyen',
        location: '',
        formattedAddress: 'Antartica',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeie42t2zs4efh4gohbehg4qnhivdwkj7tup6sfxfk7hdsrreyne5e4/',
        lat: -90,
        lng: 0,
      },
    ],
    names: [
      'Ryan',
      'name.get',
      'lrcpunk',
      'Philip Linden',
      'Anastasia',
      'Lakshmi',
      'Andrew C',
      'zwellstronaut',
      'Jango',
      'jigglyjams',
      'pipilu',
      'wninny',
      'Eliza Maria',
      'Gohu',
      'Amy',
      'Mind4u2cn',
      'Mohit Singh',
      'coffee-crusher',
      'justinpark01',
      'Sophia Stewart',
      'Allen Hall',
      'Frankzhu',
      'Hunter',
      'Amanda Nguyen',
    ],
    formattedAddress: 'Antartica',
    lat: -90,
    lng: 0,
    color: '#6d3f79',
    size: 0.24,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
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
        uuid: '410c364d-c274-49a5-90b3-0640b89801b9',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.8726646259971645, -3.4254103705956136e-17, -3.425410370595613e-17,
          0, -3.4254103705956136e-17, 3.875409442231813e-16, 0.8726646259971645,
          0, -8.556539678839237e-16, 21.798817341017674, -4.840309784319192e-15,
          0, 7.4987989133092885e-31, -100, 1.2246467991473532e-14, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
      },
    },
  },
  {
    citizens: [
      {
        id: '3',
        name: 'Pablo Moncada-Larrotiz',
        location: 'San Francisco, CA',
        formattedAddress: 'San Francisco, CA, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiddtqyq2yhvm7crtb3ayzlwhgnh5sy5ovcbmyaml6gvgrpdcy5zgy/',
        lat: 37.7749295,
        lng: -122.4194155,
      },
      {
        id: '12',
        name: 'Kevin Myrick',
        location: 'San Francisco Bay Area',
        formattedAddress: 'San Francisco, CA, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeichlakvzfikdvq62wggazuuramyg7mgfq66sladgdzkjjmh3s2r5m/',
        lat: 37.7749295,
        lng: -122.4194155,
      },
      {
        id: '13',
        name: 'jade',
        location: 'San Francisco',
        formattedAddress: 'San Francisco, CA, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiaznjofltqlopcghkggfy5omdps4tfkyechlrn6okqcfkdcrg33tq/',
        lat: 37.7749295,
        lng: -122.4194155,
      },
      {
        id: '18',
        name: 'somefoundersalt',
        location: 'San Francisco, CA',
        formattedAddress: 'San Francisco, CA, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeihivoza5rgiafrbyexdlw3pwn6mxaannmtymn3y5rbrhnvh5egipi/',
        lat: 37.7749295,
        lng: -122.4194155,
      },
    ],
    names: [
      'Pablo Moncada-Larrotiz',
      'Kevin Myrick',
      'jade',
      'somefoundersalt',
    ],
    formattedAddress: 'San Francisco, CA, USA',
    lat: 37.7749295,
    lng: -122.4194155,
    color: '#6d3f79',
    size: 0.04,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
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
        uuid: 'e54b1ed4-ebec-434f-a55a-0de879e02e9a',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.46784674319992164, 4.8442618027897664e-17, -0.7366566190186565, 0,
          0.45124730126300855, 0.6897742981687467, 0.2865847870272183, 0,
          2.419069003885735, -2.22085609960749, 1.536337997684043, 0,
          -66.72327573790666, 61.25612525740167, -42.3756013910457, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
      },
    },
  },
  {
    citizens: [
      {
        id: '4',
        name: 'Dr Eiman Jahangir',
        location: 'Nashville, TN',
        formattedAddress: 'Nashville, TN, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifj7eokk5jh7zfxsc3nr76ko2bum6thbc4abeapaza7nbffzhbvjm/',
        lat: 36.1626638,
        lng: -86.7816016,
      },
    ],
    names: ['Dr Eiman Jahangir'],
    formattedAddress: 'Nashville, TN, USA',
    lat: 36.1626638,
    lng: -86.7816016,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '9bfb2ed3-a1be-4153-9e3a-4d8f8067bc1c',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.04899323698319445, 9.688523605579533e-17, -0.8712882486276743, 0,
          0.5141295039638737, 0.7045414249523251, -0.028909914333664046, 0,
          0.725086502001259, -0.5307950264382867, -0.04077219551832127, 0,
          -80.6071648380684, 59.00796949501561, 4.532605524836481, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '7',
        name: "Andrew 'Titan' Parris",
        location: 'Houston, TX',
        formattedAddress: 'Houston, TX, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeieqnw3e5563ov2lv4thn4rkv4w5jvyxsjpfujiytcn2gf5rjtmxo4/',
        lat: 29.7600771,
        lng: -95.37011079999999,
      },
      {
        id: '19',
        name: 'IM-Hunter',
        location: 'Houston, Texas',
        formattedAddress: 'Houston, TX, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeihzojp6hifpwe32lxmmvuxxjw5f3uobq6sxhukkauoxa7glalfvmi/',
        lat: 29.7600771,
        lng: -95.37011079999999,
      },
      {
        id: '23',
        name: 'EngiBob',
        location: 'Space City, Texas',
        formattedAddress: 'Houston, TX, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeigh7u7b4syqnnvwcg65kmnoluby537xyth6kkobfdj2xmupymwhou/',
        lat: 29.7600771,
        lng: -95.37011079999999,
      },
    ],
    names: ["Andrew 'Titan' Parris", 'IM-Hunter', 'EngiBob'],
    formattedAddress: 'Houston, TX, USA',
    lat: 29.7600771,
    lng: -95.37011079999999,
    color: '#6d3f79',
    size: 0.03,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
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
        uuid: 'e14981fa-453d-49ae-8115-bfb5768ca220',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.0816717667069878, -7.26639270418465e-17, -0.8688344330134082, 0,
          0.43126264685993826, 0.7575702212168817, 0.04053934897771166, 0,
          2.34818595737506, -1.3485657670083262, 0.22073307457463653, 0,
          -86.43013181316837, 49.636919356910745, -8.12456469688549, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
      },
    },
  },
  {
    citizens: [
      {
        id: '8',
        name: 'Ben Haldeman',
        location: 'Vista, California',
        formattedAddress: 'Vista, CA, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiehm3vcwgzq3kjd5oawechsunvzrqmev34acdti6mxrj25qisherm/',
        lat: 33.2000368,
        lng: -117.2425355,
      },
    ],
    names: ['Ben Haldeman'],
    formattedAddress: 'Vista, CA, USA',
    lat: 33.2000368,
    lng: -117.2425355,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '73050846-c4c9-44e5-87c0-2e87b2147a3b',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.3994692923962696, 2.4221309013948832e-17, -0.7758658607640854, 0,
          0.4248360286974809, 0.7302143097452634, 0.21873490812070512, 0,
          0.669203821877125, -0.49255062230915697, 0.34455231337394715, 0,
          -74.39474136041926, 54.75637609303951, -38.303547291000775, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '10',
        name: 'Topher',
        location: 'Santa Cruz, CA',
        formattedAddress: 'Santa Cruz, CA, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeia7hdqxy4wk7uzmv2yndvgitlzkxxy7hkl44ycii5mocummwzpoe4/',
        lat: 36.9741171,
        lng: -122.0307963,
      },
    ],
    names: ['Topher'],
    formattedAddress: 'Santa Cruz, CA, USA',
    lat: 36.9741171,
    lng: -122.0307963,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '0f734af3-f448-45d3-bceb-4f9ef1531eb5',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.4628395104634199, 0, -0.7398129067681595, 0, 0.4449635686671779,
          0.6971781345460522, 0.2783767604104696, 0, 0.6092381521134016,
          -0.5410267335052715, 0.38114972785703405, 0, -67.72841587521356,
          60.14541846951305, -42.37204644764374, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '15',
        name: 'Xtina Korp',
        location: 'Winter Park, FL USA',
        formattedAddress: 'Winter Park, FL, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeidvboxpq6x4exwuletc7n5yzawum3n3bew634kdzcf7xitw6twvgu/',
        lat: 28.5999998,
        lng: -81.33923519999999,
      },
    ],
    names: ['Xtina Korp'],
    formattedAddress: 'Winter Park, FL, USA',
    lat: 28.5999998,
    lng: -81.33923519999999,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '410e1ed6-9d30-4ed4-a525-8d91cdc4ca23',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.1314092258517865, -2.4221309013948832e-17, -0.8627138371602749, 0,
          0.41297408693732957, 0.7661846863419154, -0.06290452607079368, 0,
          0.7806857497091794, -0.43055318118675723, -0.11891464537127357, 0,
          -86.79715443592198, 47.8691854875868, 13.22100837991254, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '16',
        name: 'Olivier "Chef" Barbeyrac',
        location: 'Charleston, SC',
        formattedAddress: 'Charleston, SC, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeicviutjvy4j4574fvyvazugrfygcxii4plhpgwsmhe5bypnb47im4/',
        lat: 32.7833163,
        lng: -79.9319664,
      },
    ],
    names: ['Olivier "Chef" Barbeyrac'],
    formattedAddress: 'Charleston, SC, USA',
    lat: 32.7833163,
    lng: -79.9319664,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: 'ff381424-5aa1-418b-a6a5-ae3c6cb66881',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.15255698356132427, 0, -0.8592263474972364, 0, 0.4652396422695772,
          0.7336703615667001, -0.08260402705821886, 0, 0.74453407968748,
          -0.4870122572769674, -0.13219319180164452, 0, -82.77778801715635,
          54.14634265170433, 14.697325893881219, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '17',
        name: 'Rick Tumlinson',
        location: 'Austin, Texas',
        formattedAddress: 'Austin, TX, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeidupcr4nxhhxi52w6jghlqtlu76nwag2jaobmvt4bcscsac2n7muq/',
        lat: 30.267153,
        lng: -97.7430608,
      },
    ],
    names: ['Rick Tumlinson'],
    formattedAddress: 'Austin, TX, USA',
    lat: 30.267153,
    lng: -97.7430608,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: 'ecc91b60-ea0b-41c7-9a79-3f2a04dbbd6f',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.11757491109375982, -2.4221309013948832e-17, -0.8647078638176399, 0,
          0.43584092375714667, 0.7537070407564852, 0.05926158417888008, 0,
          0.7697469938571124, -0.4533455555182169, 0.10466301759749609, 0,
          -85.58097637531004, 50.40325663663238, -11.636503043028032, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '20',
        name: 'Carlos Risk Hernandez',
        location: 'Raleigh, North Carolina',
        formattedAddress: 'Raleigh, NC, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeicg4jkqavyk3fjhyozcapfyn5u6glshvf7k53istlnffjfr4jqgam/',
        lat: 35.7795897,
        lng: -78.6381787,
      },
    ],
    names: ['Carlos Risk Hernandez'],
    formattedAddress: 'Raleigh, NC, USA',
    lat: 35.7795897,
    lng: -78.6381787,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '98ff3605-d8f9-41f6-8cce-a2d5d3a5f2c9',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.1719185081222258, 0, -0.8555627247793111, 0, 0.5002207589833678,
          0.7079685031766448, -0.10051537324556863, 0, 0.7153882659457955,
          -0.5258726938053926, -0.14375156823396149, 0, -79.53733730130817,
          58.46687150990567, 15.982393777595107, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '22',
        name: 'Doctor Proctor',
        location: 'Phoenix, USA',
        formattedAddress: 'Phoenix, AZ, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeihbxcjy4zjuky6xrx7rxpwe3umm57qazvkh24rnvdywljndu6av5q/',
        lat: 33.4483771,
        lng: -112.0740373,
      },
    ],
    names: ['Doctor Proctor'],
    formattedAddress: 'Phoenix, AZ, USA',
    lat: 33.4483771,
    lng: -112.0740373,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: 'e79388a7-172a-4d23-af81-067c9a5be492',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.3279511907716229, 4.8442618027897664e-17, -0.8086974501865616, 0,
          0.44574225906324566, 0.7281363305407715, 0.18076192104142466, 0,
          0.695464226138462, -0.49575659528954, 0.2820317054895592, 0,
          -77.32216946868306, 55.118543895546566, -31.35647026517757, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '24',
        name: 'Astronautgio',
        location: 'Bogota, Colombia',
        formattedAddress: 'Bogotá, Bogota, Colombia',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeiglqtycrunh2stnxcy22illolx37o6vfk2svzmqw3diebpdcbtcym/',
        lat: 4.710988599999999,
        lng: -74.072092,
      },
    ],
    names: ['Astronautgio'],
    formattedAddress: 'Bogotá, Bogota, Colombia',
    lat: 4.710988599999999,
    lng: -74.072092,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '8c8d47db-0dbe-4b91-ab79-a9bcc268b34c',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.2394832915301255, -6.055327253487208e-18, -0.8391610706799191, 0,
          0.06892000458026419, 0.8697164627108251, -0.01966867878627866, 0,
          0.861893497310884, -0.07386272024469372, -0.24597076639551665, 0,
          -95.8359109662727, 8.212964946577262, 27.350052578577355, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '26',
        name: 'Antonio Peronace',
        location: 'Washington, D.C.',
        formattedAddress: 'Washington, DC, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeifjrncateq2tws3eegwaiuwqwnm7gkwhnkcvootxnvjkyx3x463eq/',
        lat: 38.9071923,
        lng: -77.0368707,
      },
    ],
    names: ['Antonio Peronace'],
    formattedAddress: 'Washington, DC, USA',
    lat: 38.9071923,
    lng: -77.0368707,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: 'fce73887-3919-47b8-a241-ee8e55c3599d',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.19575960729936415, 0, -0.8504244385110118, 0, 0.5341182064441674,
          0.6790764705836279, -0.12294892480750035, 0, 0.6820009814295176,
          -0.5648419956579016, -0.15699013134685982, 0, -75.83325032514371,
          62.806074503143684, 17.456092077829357, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '28',
        name: 'Elliot Briant',
        location: 'Vitória, Espírito Santo - Brazil',
        formattedAddress: 'Vitoria, Vitória - State of Espírito Santo, Brazil',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeibhvhi4u65ywnbjklbvzxzxzjjmxrbokgerh7kq3nno72nfscog4u/',
        lat: -20.3196711,
        lng: -40.3385246,
      },
    ],
    names: ['Elliot Briant'],
    formattedAddress: 'Vitoria, Vitória - State of Espírito Santo, Brazil',
    lat: -20.3196711,
    lng: -40.3385246,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '48a8d64c-dd74-42e7-97bd-2a671d561a8e',
        type: 'Mesh',
        layers: 1,
        matrix: [
          -0.6651740098263272, -1.2110654506974416e-17, -0.564877939132284, 0,
          -0.1961581756658231, 0.8183585034230052, 0.23098675170123226, 0,
          0.5459197400730091, 0.3123036992388302, -0.6428497156492264, 0,
          -60.702065588848875, -34.725763227210486, 71.4799314600595, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '31',
        name: 'Rachel Williams',
        location: 'I live/ work between La Serena, Chile and Taos, New Mexico',
        formattedAddress: 'Taos, NM 87571, USA',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeieuaqitvms5ye45jmnwg7cqxx2uwgb7stfqabm7gmrjfnent7nn3q/',
        lat: 36.4072134,
        lng: -105.5733788,
      },
    ],
    names: ['Rachel Williams'],
    formattedAddress: 'Taos, NM 87571, USA',
    lat: 36.4072134,
    lng: -105.5733788,
    color: '#3142a2',
    size: 0.01,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
          type: 'MeshLambertMaterial',
          color: 3228322,
          emissive: 0,
          envMapRotation: [0, 0, 0, 'XYZ'],
          reflectivity: 1,
          refractionRatio: 0.98,
          blendColor: 0,
        },
      ],
      object: {
        uuid: '55cfa7da-300b-4464-9475-3a74f2187e69',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.23428626155616952, 4.8442618027897664e-17, -0.8406268477230581, 0,
          0.49892902830490804, 0.7023371422947281, 0.13905363258385836, 0,
          0.6971624951239588, -0.5337223420874663, 0.19430213907892455, 0,
          -77.52720883519208, 59.35202160819857, -21.607161341658134, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '8024c8b4-e68c-4666-8f3c-8cd590668afb',
      },
    },
  },
  {
    citizens: [
      {
        id: '33',
        name: 'Collin',
        location: 'United States',
        formattedAddress: 'United States',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeicq63t2hnoc3ha6s7s3hn5ftul6fwgkbjjdc42omsh76tnucohbfq/',
        lat: 38.7945952,
        lng: -106.5348379,
      },
      {
        id: '39',
        name: 'AstroFlea',
        location: 'USA',
        formattedAddress: 'United States',
        image:
          'https://b507f59d2508ebfb5e70996008095782.ipfscdn.io/ipfs/bafybeigzsvekf37xjrhe54xk5oraogtlhc43adhdbodvg47ptqi6lwt73u/',
        lat: 38.7945952,
        lng: -106.5348379,
      },
    ],
    names: ['Collin', 'AstroFlea'],
    formattedAddress: 'United States',
    lat: 38.7945952,
    lng: -106.5348379,
    color: '#6d3f79',
    size: 0.02,
    __threeObj: {
      metadata: {
        version: 4.6,
        type: 'Object',
        generator: 'Object3D.toJSON',
      },
      geometries: [
        {
          uuid: '58c90d88-d029-4ed7-9477-ded526ca8111',
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
          uuid: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
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
        uuid: 'e4430506-e522-4c0d-bb80-5155f3c7f9a1',
        type: 'Mesh',
        layers: 1,
        matrix: [
          0.24835885955178374, -4.8442618027897664e-17, -0.836577208839034, 0,
          0.524140963281015, 0.6801522525739726, 0.15560434889864802, 0,
          1.350620710302333, -1.1325517434886028, 0.4009655244651179, 0,
          -74.71665585537772, 62.65302924142473, -22.181507267591808, 1,
        ],
        up: [0, 1, 0],
        geometry: '58c90d88-d029-4ed7-9477-ded526ca8111',
        material: '3d5b18b1-64f8-4278-a640-63ba682ddd76',
      },
    },
  },
]
