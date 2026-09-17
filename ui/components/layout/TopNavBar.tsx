import { ChevronDownIcon } from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { isGroupActive, type NavGroup } from '@/lib/navigation/nav-config'
import { LogoSidebar } from '../assets'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import AccountMenu from './account/AccountMenu'
import { NavLink } from './NavLink'
import LanguageChange from './Sidebar/LanguageChange'

interface TopNavBarProps {
  navigation: NavGroup[]
  lightMode: boolean
  setLightMode: (mode: boolean) => void
  citizenContract: any
}

const TopNavBar = ({ navigation, citizenContract }: TopNavBarProps) => {
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

  // Close any open menu once navigation actually happens, so the panel does not
  // hang over the page the user just asked for.
  useEffect(() => {
    const close = () => setOpenDropdown(null)
    router.events.on('routeChangeComplete', close)
    return () => router.events.off('routeChangeComplete', close)
  }, [router.events])

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
    <nav
      className={`fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-gray-900/95 via-blue-900/80 to-purple-900/70 backdrop-blur-xl border-b border-white/20 shadow-2xl transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {/* One step, at `navwide` (see tailwind.config): the md:/lg:/xl: steps this
          used to carry were dead code, because Layout only mounts this bar from
          xl: up and hands everything narrower to the mobile drawer. The
          `navicons` step is gone with them — it existed to hide the icons below
          1500px because eight of them cost 192px the row did not have. Five
          items fit with room to spare. */}
      <div className="max-w-full mx-auto px-4 navwide:px-6">
        <div className="flex items-center justify-between h-16 lg:h-18 min-w-0">
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

          <div className="flex items-center gap-1 navwide:gap-2 flex-1 justify-center min-w-0">
            {navigation.map((item) => {
              const isActive = isGroupActive(item, router.pathname)
              const isOpen = openDropdown === item.name

              return (
                <div
                  key={item.name}
                  className="relative w-fit"
                  onMouseEnter={() => handleDropdownEnter(item.name)}
                  onMouseLeave={handleDropdownLeave}
                >
                  {/* The group name is a link and the chevron is a button, which
                      is the whole of the fix for the old behaviour: this was a
                      single <button> whose tooltip read "Single click: open
                      menu. Double click: go to page." Nobody double-clicks a
                      nav item, so five landing pages were unreachable from the
                      bar except via a child link that duplicated the parent. */}
                  <div
                    className={`flex items-center rounded-lg border transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-white/30'
                        : 'border-transparent hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <NavLink
                      href={item.href}
                      className={`flex items-center pl-2 navwide:pl-3 py-2 text-sm font-medium whitespace-nowrap cursor-pointer ${
                        isActive ? 'text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center justify-center w-4 h-4 mr-2 flex-shrink-0">
                        <item.icon className="w-full h-full" />
                      </span>
                      {t(item.name)}
                    </NavLink>
                    <button
                      type="button"
                      onClick={() =>
                        isOpen ? setOpenDropdown(null) : handleDropdownEnter(item.name)
                      }
                      aria-expanded={isOpen}
                      aria-label={`${item.name} menu`}
                      className={`pr-2 navwide:pr-3 pl-1 py-2 cursor-pointer ${
                        isActive ? 'text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <ChevronDownIcon
                        className={`w-3 h-3 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {isOpen && (
                    <>
                      {/* Bridges the gap between the item and the panel so the
                          pointer can cross it without triggering mouseleave. */}
                      <div
                        className="absolute top-full left-0 right-0 w-full -mt-1 h-3 z-40"
                        aria-hidden="true"
                      />
                      <div className="absolute top-full left-0 z-50 pt-2 -mt-2">
                        <div className="min-w-56 bg-gradient-to-br from-gray-900/98 via-blue-900/95 to-purple-900/90 backdrop-blur-xl border border-white/30 shadow-2xl py-2 px-2 rounded-xl">
                          {item.children.map((child) => {
                            const isChildActive = router.asPath === child.href
                            return (
                              <NavLink
                                key={child.href}
                                href={child.href}
                                className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap transition-all duration-200 rounded-lg ${
                                  isChildActive
                                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                                    : 'text-gray-300 hover:text-white hover:bg-purple-500/20'
                                }`}
                              >
                                {child.name}
                              </NavLink>
                            )
                          })}
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
              <div className="max-w-[200px] overflow-hidden scale-100 navwide:scale-105 min-w-0 flex-shrink-0 [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap [&>button]:max-w-[200px]">
                <PrivyConnectWallet
                  type="desktop"
                  citizenContract={citizenContract}
                />
              </div>
              <div className="scale-100 navwide:scale-105 flex-shrink-0 flex items-center justify-center">
                <AccountMenu />
              </div>
            </div>

            <div className="scale-100 navwide:scale-105">
              <LanguageChange />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar
