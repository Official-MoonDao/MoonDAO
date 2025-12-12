import { GlobeAmericasIcon, MoonIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { getCitizensLocationData } from '@/lib/map'
import IconOrg from '@/components/assets/IconOrg'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Tab from '@/components/layout/Tab'

const Earth = dynamic(() => import('@/components/globe/Earth'), { ssr: false })
const Moon = dynamic(() => import('@/components/globe/Moon'), { ssr: false })

export default function NetworkMap({ citizensLocationData }: { citizensLocationData: any }) {
  const router = useRouter()

  const [tab, setTab] = useState('earth')

  const descriptionSection = (
    <div className="pt-2">
      <div className="mb-6 text-white/80">
        Explore an interactive map of Citizens in the Space Acceleration Network to make connections
        locally and globally.
      </div>
      <div className="flex gap-4">
        <div className="w-fit h-fit bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 p-1.5">
          <div className="flex text-sm gap-1">
            <Tab
              tab="earth"
              setTab={setTab}
              currentTab={tab}
              icon={<GlobeAmericasIcon width={20} height={20} />}
            >
              Earth
            </Tab>
            <Tab
              tab="moon"
              setTab={setTab}
              currentTab={tab}
              icon={<MoonIcon width={20} height={20} />}
            >
              Moon
            </Tab>
            <Tab
              tab="network"
              setTab={() => router.push('/network')}
              currentTab={tab}
              icon={<IconOrg />}
            >
              Network
            </Tab>
          </div>
        </div>
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
          <div className="w-full flex justify-center">
            <div className="w-full max-w-5xl bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8">
              <div className="w-full rounded-lg z-[100] min-h-[60vh] bg-dark-cool shadow-xl shadow-[#112341] overflow-hidden">
                <div className={`flex items-center justify-center ${tab !== 'earth' && 'hidden'}`}>
                  <Earth pointsData={citizensLocationData} />
                </div>
                <div className={`${tab !== 'moon' && 'hidden'}`}>
                  <Moon />
                </div>
              </div>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    // Use the optimized centralized service
    const citizensLocationData = await getCitizensLocationData()

    return {
      props: {
        citizensLocationData,
      },
      revalidate: 60, // Refresh every minute for fresher data
    }
  } catch (error) {
    console.error('Error in getStaticProps for map:', error)
    return {
      props: { citizensLocationData: [] },
      revalidate: 60,
    }
  }
}
