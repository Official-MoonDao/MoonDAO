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
      className={`fixed top-0 left-0 right-0 z-[9999] border-b border-white/[0.08] bg-dark-cool transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {/* One step, at `navwide` (see tailwind.config): the md:/lg:/xl: steps this
          used to carry were dead code, because Layout only mounts this bar from
          xl: up and hands everything narrower to the mobile drawer. */}
      <div className="mx-auto flex h-16 min-w-0 items-stretch px-4 navwide:px-6">
        <NavLink
          href="/"
          className="ml-2 mr-4 flex shrink-0 cursor-pointer items-center navwide:ml-4 navwide:mr-8"
        >
          <div className="w-28 navwide:w-32">
            <LogoSidebar />
          </div>
        </NavLink>

        <div className="flex min-w-0 flex-1 items-stretch justify-center">
          {navigation.map((item) => {
            const isActive = isGroupActive(item, router.pathname)
            const isOpen = openDropdown === item.name

            return (
              <div
                key={item.name}
                className="relative flex items-stretch"
                onMouseEnter={() => handleDropdownEnter(item.name)}
                onMouseLeave={handleDropdownLeave}
              >
                {/* The group name is a link and the chevron is a button, which
                    is the whole of the fix for the old behaviour: this was a
                    single <button> whose tooltip read "Single click: open
                    menu. Double click: go to page." Nobody double-clicks a
                    nav item, so five landing pages were unreachable from the
                    bar except via a child link that duplicated the parent. */}
                <NavLink
                  href={item.href}
                  className={`relative flex cursor-pointer items-center px-2.5 text-[13px] font-medium tracking-wide whitespace-nowrap navwide:px-3.5 ${
                    isActive
                      ? 'text-white'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  {t(item.name)}
                  {isActive && (
                    <span className="pointer-events-none absolute inset-x-2.5 bottom-[-1px] h-px bg-moon-gold navwide:inset-x-3.5" />
                  )}
                </NavLink>
                <button
                  type="button"
                  onClick={() =>
                    isOpen ? setOpenDropdown(null) : handleDropdownEnter(item.name)
                  }
                  aria-expanded={isOpen}
                  aria-label={`${item.name} menu`}
                  className={`flex cursor-pointer items-center pr-1 ${
                    isActive || isOpen
                      ? 'text-white/80'
                      : 'text-white/35 hover:text-white'
                  }`}
                >
                  <ChevronDownIcon
                    className={`h-3 w-3 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <>
                    {/* Bridges the gap between the item and the panel so the
                        pointer can cross it without triggering mouseleave. */}
                    <div
                      className="absolute top-full left-0 right-0 z-40 h-2"
                      aria-hidden="true"
                    />
                    <div className="absolute top-full left-0 z-50 pt-1.5">
                      <div className="min-w-[13.5rem] rounded-md border border-white/[0.08] bg-[#0b1020] py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                        {item.children.map((child) => {
                          const isChildActive = router.asPath === child.href
                          return (
                            <NavLink
                              key={child.href}
                              href={child.href}
                              className={`block w-full whitespace-nowrap px-3.5 py-2 text-left text-[13px] ${
                                isChildActive
                                  ? 'text-moon-gold'
                                  : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
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

        <div className="flex shrink-0 items-center gap-3 navwide:gap-4">
          <div className="max-w-[200px] min-w-0 shrink-0 overflow-hidden [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap [&>button]:max-w-[200px]">
            <PrivyConnectWallet
              type="desktop"
              citizenContract={citizenContract}
            />
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <AccountMenu />
          </div>
          <LanguageChange />
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar
