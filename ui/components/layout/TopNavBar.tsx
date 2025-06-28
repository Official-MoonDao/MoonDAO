import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import LanguageChange from './Sidebar/LanguageChange'
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

  // Handle hover-based dropdown with proper timeout management
  const handleDropdownEnter = (itemName: string) => {
    // Clear any existing timer
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current)
      dropdownTimerRef.current = null
    }
    setOpenDropdown(itemName)
  }

  const handleDropdownLeave = () => {
    // Clear any existing timer first
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current)
    }
    // Set a new timer
    dropdownTimerRef.current = setTimeout(() => {
      setOpenDropdown(null)
      dropdownTimerRef.current = null
    }, 500) // Increased to 500ms for better UX
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (dropdownTimerRef.current) {
        clearTimeout(dropdownTimerRef.current)
      }
    }
  }, [])

  // Handle scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show navbar if at top of page
      if (currentScrollY < 10) {
        setIsVisible(true)
      }
      // Hide when scrolling down, show when scrolling up
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
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
          {/* Logo - responsive sizing */}
          <Link href="/" className="flex-shrink-0 ml-2 md:ml-4 mr-4 lg:mr-6 xl:mr-8">
            <div className="flex items-center">
              <div className="w-24 md:w-28 lg:w-32 xl:w-36 hover:scale-105 transition-transform duration-200">
                <LogoSidebar />
              </div>
            </div>
          </Link>

          {/* Navigation Links - Show on large screens and up (1024px+) */}
          <div className="hidden lg:flex items-center space-x-1 xl:space-x-2 flex-1 justify-center max-w-4xl mx-auto">
            {navigation.filter(item => item && item.name !== 'Join').map((item, i) => {
              if (!item) return null
              
              const isActive = 
                router.pathname === item.href ||
                item.children?.some((child: any) => router.pathname === child.href)

              return (
                <div
                  key={i}
                  className="relative dropdown-container"
                  onMouseEnter={() => item.children && handleDropdownEnter(item.name)}
                  onMouseLeave={() => item.children && handleDropdownLeave()}
                >
                  {item.children ? (
                    // For items with children, check if they also have an href
                    item.href ? (
                      // If they have both children and href, make it a clickable link with dropdown on hover
                      <Link
                        href={item.href}
                        className={`flex items-center px-2 lg:px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-400/30'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {t(item.name)}
                        <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                      </Link>
                    ) : (
                      // If they only have children (no href), keep as button
                      <button
                        className={`flex items-center px-2 lg:px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-400/30'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {t(item.name)}
                        <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                      </button>
                    )
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center px-2 lg:px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-400/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {t(item.name)}
                    </Link>
                  )}

                  {/* Dropdown Menu */}
                  {item.children && openDropdown === item.name && (
                    <div 
                      className="absolute top-full left-0 w-full z-50"
                      onMouseEnter={() => handleDropdownEnter(item.name)}
                      onMouseLeave={handleDropdownLeave}
                    >
                      {/* Invisible bridge to prevent dropdown from closing when moving mouse */}
                      <div className="h-2 w-full"></div>
                      <div className="w-56 bg-gradient-to-br from-gray-900/98 via-blue-900/95 to-purple-900/90 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl py-2">
                      {item.children.map((child: any, j: number) => {
                        if (!child.href) {
                          return (
                            <div key={j} className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
                              {child.name}
                            </div>
                          )
                        }
                        
                        const isChildActive = router.pathname === child.href

                        return (
                          <Link
                            key={j}
                            href={child.href}
                            className={`block px-4 py-2 text-sm transition-all duration-200 ${
                              isChildActive
                                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-l-2 border-blue-400'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {child.name}
                          </Link>
                        )
                      })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right side - Wallet and Settings - Desktop only */}
          <div className="flex items-center space-x-2 lg:space-x-3 xl:space-x-4 flex-shrink-0">
            {/* Wallet/Address Button */}
            <div className="flex items-center space-x-2">
              <div className="max-w-[200px] overflow-hidden scale-90 lg:scale-100 xl:scale-105 min-w-0 [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap [&>button]:max-w-[200px]">
                <PrivyConnectWallet
                  type="desktop"
                  citizenContract={citizenContract}
                />
              </div>
              <div className="scale-90 lg:scale-100 xl:scale-105 flex-shrink-0">
                <CitizenProfileLink />
              </div>
            </div>
            
            {/* Language Settings Only */}
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
