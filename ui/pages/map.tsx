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
import { getAllCitizenLocationData } from '@/lib/subscription/getAllCitizenLocationData'
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
  const citizenLocationData = await getAllCitizenLocationData()
  return {
    props: {
      citizenLocationData,
    },
    revalidate: 60,
  }
}
