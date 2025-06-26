import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import { PrivyConnectWallet } from '../privy/PrivyConnectWallet'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import ColorsAndSocials from './Sidebar/ColorsAndSocials'
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
  const [dropdownTimeouts, setDropdownTimeouts] = useState<Record<string, NodeJS.Timeout>>({})

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
      // Clear all timeouts on unmount
      Object.values(dropdownTimeouts).forEach(timeout => clearTimeout(timeout))
    }
  }, [lastScrollY, dropdownTimeouts])

  // Clear timeouts when component unmounts
  useEffect(() => {
    return () => {
      Object.values(dropdownTimeouts).forEach(timeout => clearTimeout(timeout))
    }
  }, [dropdownTimeouts])

  const clearDropdownTimeout = (itemName: string) => {
    if (dropdownTimeouts[itemName]) {
      clearTimeout(dropdownTimeouts[itemName])
      setDropdownTimeouts(prev => {
        const newTimeouts = { ...prev }
        delete newTimeouts[itemName]
        return newTimeouts
      })
    }
  }

  const handleMouseEnter = (itemName: string) => {
    // Clear any existing timeout for this item
    clearDropdownTimeout(itemName)
    setOpenDropdown(itemName)
  }

  const handleMouseLeave = (itemName: string) => {
    const timeout = setTimeout(() => {
      setOpenDropdown(prev => prev === itemName ? null : prev)
    }, 150) // Reduced delay for more responsive behavior
    
    setDropdownTimeouts(prev => ({
      ...prev,
      [itemName]: timeout
    }))
  }

  const handleDropdownEnter = (itemName: string) => {
    // Clear timeout when entering dropdown area
    clearDropdownTimeout(itemName)
    setOpenDropdown(itemName)
  }

  const handleDropdownLeave = (itemName: string) => {
    const timeout = setTimeout(() => {
      setOpenDropdown(prev => prev === itemName ? null : prev)
    }, 100) // Quick close when leaving dropdown
    
    setDropdownTimeouts(prev => ({
      ...prev,
      [itemName]: timeout
    }))
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-gray-900/95 via-blue-900/80 to-purple-900/70 backdrop-blur-xl border-b border-white/20 shadow-2xl transition-transform duration-300 ease-in-out ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="max-w-full mx-auto px-2 lg:px-4 xl:px-6">
        <div className="flex items-center justify-between h-16 lg:h-18 min-w-0">
          {/* Logo - responsive sizing */}
          <Link href="/" passHref className="flex-shrink-0 ml-2 md:ml-4 mr-4 lg:mr-6 xl:mr-8">
            <div className="flex items-center">
              <div className="w-24 md:w-28 lg:w-32 xl:w-36 hover:scale-105 transition-transform duration-200">
                <LogoSidebar />
              </div>
            </div>
          </Link>

          {/* Navigation Links - Show on medium screens and up */}
          <div className="hidden md:flex items-center space-x-1 xl:space-x-2 flex-1 justify-center max-w-4xl mx-auto">
            {navigation.filter(item => item && item.name !== 'Join').map((item, i) => {
              if (!item) return null
              
              const isActive = 
                router.pathname === item.href ||
                item.children?.some((child: any) => router.pathname === child.href)

              return (
                <div
                  key={i}
                  className="relative group"
                  onMouseEnter={() => item.children && handleMouseEnter(item.name)}
                  onMouseLeave={() => item.children && handleMouseLeave(item.name)}
                >
                  {item.children ? (
                    <Link
                      href={item.href || '#'}
                      passHref
                      className={`flex items-center px-2 lg:px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-400/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {t(item.name)}
                      <ChevronDownIcon className="w-3 h-3 ml-1" />
                    </Link>
                  ) : (
                    <Link
                      href={item.href}
                      passHref
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
                    <div className="absolute top-full left-0 w-full z-50">
                      {/* Invisible bridge to prevent hover gaps */}
                      <div 
                        className="w-full h-1 bg-transparent"
                        onMouseEnter={() => handleDropdownEnter(item.name)}
                        onMouseLeave={() => handleDropdownLeave(item.name)}
                      />
                      <div 
                        className="w-56 bg-gradient-to-br from-gray-900/95 via-blue-900/50 to-purple-900/40 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl py-2"
                        onMouseEnter={() => handleDropdownEnter(item.name)}
                        onMouseLeave={() => handleDropdownLeave(item.name)}
                      >
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
                            passHref
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

          {/* Right side - Wallet and Settings - Compact responsive layout */}
          <div className="flex items-center space-x-1 lg:space-x-2 xl:space-x-3 flex-shrink-0">
            {/* Mobile Menu Elements - Show only on small screens */}
            <div className="flex md:hidden items-center space-x-2">
              <div className="scale-90">
                <PrivyConnectWallet
                  type="mobile"
                  citizenContract={citizenContract}
                />
              </div>
              <div className="scale-90">
                <LanguageChange />
              </div>
              <div className="scale-90">
                <ColorsAndSocials
                  lightMode={lightMode}
                  setLightMode={setLightMode}
                />
              </div>
            </div>
            
            {/* Wallet/Address Button - Show on medium screens and up */}
            <div className="hidden md:flex items-center space-x-1">
              <div className="scale-90 lg:scale-95 xl:scale-100">
                <PrivyConnectWallet
                  type="desktop"
                  citizenContract={citizenContract}
                />
              </div>
              <div className="scale-90 lg:scale-95 xl:scale-100">
                <CitizenProfileLink />
              </div>
            </div>
            
            {/* Settings - Show on medium screens and up */}
            <div className="hidden md:flex items-center space-x-1">
              <div className="scale-90 lg:scale-95 xl:scale-100">
                <LanguageChange />
              </div>
              <div className="scale-90 lg:scale-95 xl:scale-100">
                <ColorsAndSocials
                  lightMode={lightMode}
                  setLightMode={setLightMode}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar
