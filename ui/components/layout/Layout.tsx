import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES } from 'const/config'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import React, {
  ComponentType,
  startTransition,
  useContext,
  useEffect,
  useState,
} from 'react'
import { Toaster } from 'react-hot-toast'
import CitizenContext from '@/lib/citizen/citizen-context'
import useNavigation from '@/lib/navigation/useNavigation'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useClientHydrated } from '@/lib/utils/hooks/useClientHydrated'
import MobileMenuTop from './Sidebar/MobileMenuTop'
import MobileSidebar from './Sidebar/MobileSidebar'
import TopNavBar from './TopNavBar'

/**
 * Client-only lazy mount without React.lazy / next/dynamic Suspense.
 * next/dynamic(ssr:false) creates dehydrated Suspense boundaries that race
 * Privy/light-mode/citizen setState during hydration and surface as
 * "Suspense boundary received an update before it finished hydrating",
 * which puts up a Next.js overlay that intercepts all pointer events.
 */
function useLazyClient<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  enabled: boolean
): T | null {
  const [Comp, setComp] = useState<T | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loader().then((mod) => {
      if (!cancelled) {
        startTransition(() => setComp(() => mod.default))
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, loader])
  return Comp
}

// Stable loader refs so useLazyClient's effect doesn't re-fire every render.
const loadSpaceBackground = () => import('./SpaceBackground')
const loadGlobalSearch = () => import('./GlobalSearch')
const loadMissionBanner = () => import('./MissionBanner')
const loadProjectBanner = () => import('./ProjectBanner')
const loadCookieBanner = () => import('./CookieBanner')
const loadAnalytics = () =>
  import('@vercel/analytics/next').then((m) => ({ default: m.Analytics }))

interface Layout {
  children: JSX.Element
  lightMode: boolean
  setLightMode: (mode: boolean) => void
  missions?: any[]
}

export default function Layout({ children, lightMode, setLightMode }: Layout) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const hydrated = useClientHydrated()

  const SpaceBackground = useLazyClient(loadSpaceBackground, hydrated)
  const GlobalSearch = useLazyClient(loadGlobalSearch, hydrated)
  const MissionBanner = useLazyClient(loadMissionBanner, hydrated)
  const ProjectBanner = useLazyClient(loadProjectBanner, hydrated)
  const CookieBanner = useLazyClient(loadCookieBanner, hydrated)
  const Analytics = useLazyClient(loadAnalytics, hydrated)

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
      {SpaceBackground ? <SpaceBackground /> : null}
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

        {GlobalSearch ? <GlobalSearch /> : null}
        {MissionBanner ? <MissionBanner /> : null}
        {ProjectBanner ? <ProjectBanner /> : null}
        {CookieBanner ? <CookieBanner /> : null}
      </>

      <Toaster />
      {Analytics ? <Analytics /> : null}
    </div>
  )
}
