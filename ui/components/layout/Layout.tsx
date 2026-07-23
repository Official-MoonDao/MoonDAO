import { Analytics } from '@vercel/analytics/next'
import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import useTranslation from 'next-translate/useTranslation'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import React, { useContext, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import CitizenContext from '@/lib/citizen/citizen-context'
import useNavigation from '@/lib/navigation/useNavigation'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import MobileMenuTop from './Sidebar/MobileMenuTop'
import MobileSidebar from './Sidebar/MobileSidebar'
import TopNavBar from './TopNavBar'

// Lazy load non-critical components for better LCP
const SpaceBackground = dynamic(() => import('./SpaceBackground'), {
  ssr: false,
})
const GlobalSearch = dynamic(() => import('./GlobalSearch'), {
  ssr: false,
})
const MissionBanner = dynamic(() => import('./MissionBanner'), {
  ssr: false,
})
const ProjectBanner = dynamic(() => import('./ProjectBanner'), {
  ssr: false,
})
const CookieBanner = dynamic(() => import('./CookieBanner'), {
  ssr: false,
})

// Gate `ssr: false` dynamics so they never enter the SSR tree as dehydrated
// Suspense boundaries. Mounting them only after hydration avoids React 18's
// "Suspense boundary received an update before it finished hydrating" when a
// sibling effect (theme, auth, banners) updates during the same pass.
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  return <>{children}</>
}

interface Layout {
  children: JSX.Element
  lightMode: boolean
  setLightMode: (mode: boolean) => void
  missions?: any[]
}

export default function Layout({ children, lightMode, setLightMode }: Layout) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const router = useRouter()

  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const { citizen } = useContext(CitizenContext)
  const citizenContract = useContract({
    address: CITIZEN_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: CitizenABI as any,
  })

  const navigation = useNavigation(citizen)

  useTranslation('common')

  const fullscreenPaths = [
    '/launch',
    '/home',
    '/about',
    '/faq',
    '/constitution',
    '/news',
    '/mission/[tokenId]',
    '/network',
    '/join',
    '/mooney',
    '/governance',
    '/projects-overview',
    '/get-mooney',
    '/lock',
    '/dashboard',
    '/bridge',
    '/roadmap',
  ]

  const isFullscreen = fullscreenPaths.includes(router.pathname)
  const isHomepage = router.pathname === '/'

  return (
    <div
      id="app-layout"
      className={`${
        !lightMode ? 'dark background-dark' : 'background-light'
      } min-h-screen relative`}
    >
      <ClientOnly>
        <SpaceBackground />
      </ClientOnly>
      <>
        <div className="xl:hidden">
          <MobileMenuTop
            setSidebarOpen={setSidebarOpen}
            lightMode={lightMode}
            setLightMode={setLightMode}
            citizenContract={citizenContract}
            isFullscreen={isFullscreen}
          />
        </div>

        <MobileSidebar
          navigation={navigation}
          lightMode={lightMode}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isFullscreen={isFullscreen}
        />

        <div className="hidden xl:block">
          <TopNavBar
            navigation={navigation}
            lightMode={lightMode}
            setLightMode={setLightMode}
            citizenContract={citizenContract}
          />
        </div>

        <main
          className={`pt-16 w-full min-h-screen relative z-10 ${
            isFullscreen || isHomepage ? '' : 'flex justify-center'
          }`}
        >
          <div
            className={`w-full min-h-screen ${
              isFullscreen || isHomepage ? '' : 'max-w-7xl px-4 sm:px-6 lg:px-8'
            }`}
          >
            {children}
          </div>
        </main>

        <ClientOnly>
          <GlobalSearch />
          <MissionBanner />
          <ProjectBanner />
          <CookieBanner />
        </ClientOnly>
      </>

      <ClientOnly>
        <Toaster />
        <Analytics />
      </ClientOnly>
    </div>
  )
}
