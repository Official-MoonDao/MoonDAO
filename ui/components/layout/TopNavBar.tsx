import { NavLink } from './NavLink'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import LanguageChange from './Sidebar/LanguageChange'
import { TeamsNavDropdown } from './Sidebar/TeamsNavDropdown'
import { ProjectsNavDropdown } from './Sidebar/ProjectsNavDropdown'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { LogoSidebar } from '../assets'

interface TopNavBarProps {
  navigation: any[]
  lightMode: boolean
  setLightMode: (mode: boolean) => void
  citizenContract: any
}

// A nav item's icon, in a fixed box.
//
// The box exists because the icons do not agree with each other. Most are
// heroicons that take a className, but Citizens' is a hand-rolled SVG that
// accepts no props at all and hard-codes its own `mr-2 h-5 w-5` — so styling
// them through `item.icon`'s className silently missed that one, which is how
// the bar came to hide seven icons and leave the eighth showing at a size the
// others were not. Sizing from the outside cannot be ignored by an icon, and
// the child overrides win on specificity (two classes and an element beats the
// icon's one class), so every item gets the same 16px mark either way.
//
// Below `navicons` they all go: eight of them cost 192px, and nothing is lost
// that the label beside them was not already saying.
function NavItemIcon({ icon: Icon }: { icon: any }) {
  return (
    <span className="hidden navicons:flex items-center justify-center w-4 h-4 mr-2 flex-shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:m-0">
      <Icon />
    </span>
  )
}

const TopNavBar = ({
  navigation,
  lightMode,
  setLightMode,
  citizenContract,
}: TopNavBarProps) => {
  const router = useRouter()
  const { t } = useTranslation('common')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const dropdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleDropdownEnter = (itemName: string) => {
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current)
      dropdownTimerRef.current = null
    }
    setOpenDropdown(itemName)
  }

  const handleDropdownLeave = () => {
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current)
    }
    dropdownTimerRef.current = setTimeout(() => {
      setOpenDropdown(null)
      dropdownTimerRef.current = null
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (dropdownTimerRef.current) {
        clearTimeout(dropdownTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY < 10) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-gray-900/95 via-blue-900/80 to-purple-900/70 backdrop-blur-xl border-b border-white/20 shadow-2xl transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
      {/* Steps at `navicons` and `navwide` (see tailwind.config), and at nothing
          else: the md:/lg:/xl: steps this used to carry were dead code, because
          Layout only mounts this bar from xl: up and hands everything narrower
          to the mobile drawer. */}
      <div className="max-w-full mx-auto px-4 navwide:px-6">
        <div className="flex items-center justify-between h-16 lg:h-18 min-w-0">
          {/* The gutter and this margin both stand the logo off the window edge,
              so they are read together: 32px of clear space at the compact end,
              48px at the wide one. It used to be 20px, which read as the mark
              being cropped by the screen rather than placed on it. */}
          <NavLink
            href="/"
            className="flex-shrink-0 ml-4 mr-2 navwide:ml-6 navwide:mr-8 cursor-pointer"
          >
            <div className="flex items-center">
              <div className="w-28 navwide:w-36 hover:scale-105 transition-transform duration-200">
                <LogoSidebar />
              </div>
            </div>
          </NavLink>

          {/* No max-width. It used to be capped at 1024px, which is 54px NARROWER
              than the items it holds — so the row overflowed its own box at every
              window size, including a 2560px one, and the spill landed on the
              logo and the wallet because the box is centred. */}
          <div className="flex items-center gap-1 navwide:gap-2 flex-1 justify-center min-w-0">
            {navigation.map((item, i) => {
              if (!item) return null
              const hasDropdown = item.children || item.dynamicChildren
              const isNetworkTeams =
                router.pathname === '/network' && router.query.tab === 'teams'
              const isActive =
                (!isNetworkTeams && router.pathname === item.href) ||
                (!isNetworkTeams &&
                  item.children?.some(
                    (child: any) => router.pathname === child.href
                  )) ||
                (item.dynamicChildren === 'Teams' &&
                  (router.pathname.startsWith('/team') ||
                    router.pathname === '/join' ||
                    router.pathname === '/jobs' ||
                    router.pathname === '/marketplace' ||
                    isNetworkTeams)) ||
                (item.dynamicChildren === 'Projects' &&
                  (router.pathname.startsWith('/project') ||
                    router.pathname === '/projects' ||
                    router.pathname === '/proposals' ||
                    router.pathname === '/projects-overview'))

              return (
                <div
                  key={i}
                  className="relative dropdown-container w-fit"
                  onMouseEnter={() => hasDropdown && handleDropdownEnter(item.name)}
                  onMouseLeave={() => hasDropdown && handleDropdownLeave()}
                >
                  {hasDropdown ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        if (e.detail === 2 && item.href) {
                          window.location.href = item.href
                        } else {
                          handleDropdownEnter(item.name)
                        }
                      }}
                      title={item.href ? 'Single click: open menu. Double click: go to page.' : 'Click to open menu'}
                      className={`flex items-center px-2 navwide:px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-lg w-full text-left cursor-pointer
                        border
                        ${isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-white/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 border-transparent'
                        }`}
                    >
                      <NavItemIcon icon={item.icon} />
                      {t(item.name)}
                      <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <NavLink
                      href={item.href}
                      className={`flex items-center px-2 navwide:px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-lg cursor-pointer border border-transparent hover:border-white/20 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-white/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <NavItemIcon icon={item.icon} />
                      {t(item.name)}
                    </NavLink>
                  )}

                  {hasDropdown && (
                    <>
                      {openDropdown === item.name && (
                        <div
                          className="absolute top-full left-0 right-0 w-full -mt-1 h-48 z-40"
                          onMouseEnter={() => handleDropdownEnter(item.name)}
                          aria-hidden="true"
                        />
                      )}
                      <div
                        className={`absolute top-full left-0 right-0 z-50 pt-2 -mt-2 ${
                          openDropdown === item.name
                            ? ''
                            : 'hidden pointer-events-none'
                        }`}
                        onMouseEnter={() => handleDropdownEnter(item.name)}
                        onMouseLeave={handleDropdownLeave}
                      >
                          <div className="min-w-56 max-w-xs w-full bg-gradient-to-br from-gray-900/98 via-blue-900/95 to-purple-900/90 backdrop-blur-xl border border-white/30 shadow-2xl py-2 px-2 rounded-xl">
                          {/* Mount dynamic dropdowns only while open: their hooks
                              (useTeamWearer / useProjectWearer) can trigger the
                              on-chain role-hat index scan — hundreds of eth_calls —
                              which must not run on every page load just because the
                              nav bar exists. Results are cached (5 min TTL), so
                              reopening is cheap. */}
                          {item.dynamicChildren === 'Teams' ? (
                            openDropdown === item.name ? (
                              <TeamsNavDropdown variant="desktop" />
                            ) : null
                          ) : item.dynamicChildren === 'Projects' ? (
                            openDropdown === item.name ? (
                              <ProjectsNavDropdown variant="desktop" />
                            ) : null
                          ) : openDropdown === item.name ? (
                            item.children?.map((child: any, j: number) => {
                              if (!child.href) {
                                return (
                                  <div key={j} className="px-3 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
                                    {child.name}
                                  </div>
                                )
                              }
                              const isChildActive = router.pathname === child.href
                              return (
                                <NavLink
                                  key={j}
                                  href={child.href}
                                  className={`block w-full text-left px-3 py-2 text-sm transition-all duration-200 rounded-lg ${
                                    isChildActive
                                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                                      : 'text-gray-300 hover:text-white hover:bg-purple-500/20'
                                  }`}
                                >
                                  {child.name}
                                </NavLink>
                              )
                            })
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Note the scales: a transform does not change an element's layout
              box, so scale-105 grew the wallet 5% past the space reserved for
              it and let it reach across into the nav items. Kept for the roomy
              form, dropped for the compact one, where there is nothing to
              spare. */}
          <div className="flex items-center space-x-2 navwide:space-x-4 flex-shrink-0">
            <div className="flex items-center space-x-3 navwide:space-x-6">
              <div className="max-w-[200px] overflow-hidden scale-100 navwide:scale-105 min-w-0 [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap [&>button]:max-w-[200px]">
                <PrivyConnectWallet
                  type="desktop"
                  citizenContract={citizenContract}
                />
              </div>
              <div className="scale-100 navwide:scale-105 flex-shrink-0 flex items-center justify-center">
                <CitizenProfileLink />
              </div>
            </div>

            <div className="scale-100 navwide:scale-105">
              <LanguageChange />
            </div>
          </div>
        </div>
      </div>
    </nav>
    </>
  )
}

export default TopNavBar
