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
      <nav
        className={`fixed top-0 left-0 right-0 z-[9999] transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{
          background: 'linear-gradient(90deg, rgba(5,5,5,0.97) 0%, rgba(10,15,18,0.97) 50%, rgba(5,5,8,0.97) 100%)',
          borderBottom: '1px solid rgba(0, 255, 200, 0.25)',
          backdropFilter: 'blur(12px)',
          animation: 'borderGlow 6s ease-in-out infinite',
        }}
      >
      <div className="max-w-full mx-auto px-2 lg:px-4 xl:px-6">
        <div className="flex items-center justify-between h-16 lg:h-18 min-w-0">
          <NavLink
            href="/"
            className="flex-shrink-0 ml-2 md:ml-4 mr-4 lg:mr-6 xl:mr-8 cursor-pointer"
          >
            <div className="flex items-center">
              <div className="w-24 md:w-28 lg:w-32 xl:w-36 hover:scale-105 transition-transform duration-200" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 200, 0.3))' }}>
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
                      className={`flex items-center px-2 lg:px-3 py-2 text-sm transition-all duration-200 whitespace-nowrap w-full text-left cursor-pointer border uppercase tracking-wider
                        ${isActive
                          ? 'text-retro-cyan border-retro-cyan/40'
                          : 'text-[#b0ffe0] hover:text-retro-cyan hover:border-retro-cyan/30 border-transparent'
                        }`}
                      style={{
                        fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
                        fontSize: '12px',
                        ...(isActive ? {
                          textShadow: '0 0 8px rgba(0, 255, 200, 0.4)',
                          background: 'rgba(0, 255, 200, 0.05)',
                          animation: 'borderGlow 5s ease-in-out infinite',
                        } : {}),
                      }}
                    >
                      <item.icon className="w-4 h-4 mr-2" style={{ filter: isActive ? 'drop-shadow(0 0 4px rgba(0, 255, 200, 0.5))' : 'none' }} />
                      {t(item.name)}
                      <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <NavLink
                      href={item.href}
                      className={`flex items-center px-2 lg:px-3 py-2 text-sm transition-all duration-200 whitespace-nowrap cursor-pointer border uppercase tracking-wider ${
                        isActive
                          ? 'text-retro-cyan border-retro-cyan/40'
                          : 'text-[#b0ffe0] hover:text-retro-cyan hover:border-retro-cyan/30 border-transparent'
                      }`}
                      style={{
                        fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
                        fontSize: '12px',
                        ...(isActive ? {
                          textShadow: '0 0 8px rgba(0, 255, 200, 0.4)',
                          background: 'rgba(0, 255, 200, 0.05)',
                          animation: 'borderGlow 5s ease-in-out infinite',
                        } : {}),
                      }}
                    >
                      <item.icon className="w-4 h-4 mr-2" style={{ filter: isActive ? 'drop-shadow(0 0 4px rgba(0, 255, 200, 0.5))' : 'none' }} />
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
                        <div
                          className="min-w-56 w-full py-2 px-2"
                          style={{
                            background: 'rgba(5, 5, 8, 0.97)',
                            border: '1px solid rgba(0, 255, 200, 0.2)',
                            boxShadow: '0 4px 30px rgba(0, 255, 200, 0.08), inset 0 0 20px rgba(0, 255, 200, 0.02)',
                            backdropFilter: 'blur(12px)',
                          }}
                        >
                          {item.dynamicChildren === 'Teams' ? (
                            <TeamsNavDropdown variant="desktop" />
                          ) : item.dynamicChildren === 'Projects' ? (
                            <ProjectsNavDropdown variant="desktop" />
                          ) : openDropdown === item.name ? (
                            item.children?.map((child: any, j: number) => {
                              if (!child.href) {
                                return (
                                  <div
                                    key={j}
                                    className="px-3 py-2 text-xs font-medium uppercase tracking-wider"
                                    style={{
                                      color: '#ff9f1c',
                                      fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
                                      borderBottom: '1px solid rgba(0, 255, 200, 0.08)',
                                    }}
                                  >
                                    {child.name}
                                  </div>
                                )
                              }
                              const isChildActive = router.pathname === child.href
                              return (
                                <NavLink
                                  key={j}
                                  href={child.href}
                                  className={`block w-full text-left px-3 py-2 text-sm transition-all duration-200 ${
                                    isChildActive
                                      ? 'text-retro-cyan'
                                      : 'text-[#b0ffe0] hover:text-retro-cyan'
                                  }`}
                                  style={{
                                    fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
                                    ...(isChildActive ? {
                                      textShadow: '0 0 6px rgba(0, 255, 200, 0.3)',
                                      background: 'rgba(0, 255, 200, 0.05)',
                                    } : {}),
                                  }}
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
