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
      <div className="max-w-full mx-auto px-2 lg:px-4 xl:px-6">
        <div className="flex items-center justify-between h-16 lg:h-18 min-w-0">
          <NavLink
            href="/"
            className="flex-shrink-0 ml-2 md:ml-4 mr-4 lg:mr-6 xl:mr-8 cursor-pointer"
          >
            <div className="flex items-center">
              <div className="w-24 md:w-28 lg:w-32 xl:w-36 hover:scale-105 transition-transform duration-200">
                <LogoSidebar />
              </div>
            </div>
          </NavLink>

          <div className="hidden lg:flex items-center gap-1 xl:gap-2 flex-1 justify-center max-w-[1024px] mx-auto">
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
                    router.pathname === '/contributions' ||
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
                      className={`flex items-center px-2 lg:px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-lg w-full text-left cursor-pointer
                        border
                        ${isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-white/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 border-transparent'
                        }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {t(item.name)}
                      <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <NavLink
                      href={item.href}
                      className={`flex items-center px-2 lg:px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-lg cursor-pointer border border-transparent hover:border-white/20 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-white/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
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
                          {item.dynamicChildren === 'Teams' ? (
                            <TeamsNavDropdown variant="desktop" />
                          ) : item.dynamicChildren === 'Projects' ? (
                            <ProjectsNavDropdown variant="desktop" />
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

          <div className="flex items-center space-x-2 lg:space-x-3 xl:space-x-4 flex-shrink-0">
            <div className="flex items-center space-x-4 lg:space-x-6">
              <div className="max-w-[200px] overflow-hidden scale-90 lg:scale-100 xl:scale-105 min-w-0 [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap [&>button]:max-w-[200px]">
                <PrivyConnectWallet
                  type="desktop"
                  citizenContract={citizenContract}
                />
              </div>
              <div className="scale-90 lg:scale-100 xl:scale-105 flex-shrink-0 flex items-center justify-center">
                <CitizenProfileLink />
              </div>
            </div>
            
            <div className="scale-90 lg:scale-100 xl:scale-105">
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
