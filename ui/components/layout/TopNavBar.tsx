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
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null)

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
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout)
      }
    }
  }, [lastScrollY, dropdownTimeout])

  const handleMouseEnter = (itemName: string) => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout)
      setDropdownTimeout(null)
    }
    setOpenDropdown(itemName)
  }

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setOpenDropdown(null)
    }, 150) // 150ms delay before closing
    setDropdownTimeout(timeout)
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-gray-900/95 via-blue-900/80 to-purple-900/70 backdrop-blur-xl border-b border-white/20 shadow-2xl transition-transform duration-300 ease-in-out ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo - moved to far left */}
          <Link href="/" className="flex-shrink-0 mr-8">
            <div className="flex items-center space-x-2">
              <Image
                src="/assets/MoonDAO-Logo-White.svg"
                alt="MoonDAO Logo"
                width={40}
                height={40}
                className="hover:scale-105 transition-transform duration-200"
              />
              <span className="text-white font-bold text-xl font-GoodTimes hidden sm:block">
                MoonDAO
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1 flex-1 justify-center">
            {navigation.filter(item => item && item.name !== 'Join').map((item, i) => {
              if (!item) return null
              
              const isActive = 
                router.pathname === item.href ||
                item.children?.some((child: any) => router.pathname === child.href)

              return (
                <div
                  key={i}
                  className="relative"
                  onMouseEnter={() => item.children && handleMouseEnter(item.name)}
                  onMouseLeave={handleMouseLeave}
                >
                  {item.children ? (
                    <Link
                      href={item.href || '#'}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
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
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
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
                      className="absolute top-full left-0 mt-1 w-56 bg-gradient-to-br from-gray-900 via-blue-900/40 to-purple-900/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-2 z-50"
                      onMouseEnter={() => handleMouseEnter(item.name)}
                      onMouseLeave={handleMouseLeave}
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
                  )}
                </div>
              )
            })}
          </div>

          {/* Right side - Wallet and Settings */}
          <div className="flex items-center space-x-4">
            {/* Wallet/Address Button */}
            <div className="hidden md:flex items-center">
              <PrivyConnectWallet
                type="desktop"
                citizenContract={citizenContract}
              />
              <div className="ml-2">
                <CitizenProfileLink />
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-2">
              <LanguageChange />
              <ColorsAndSocials
                lightMode={lightMode}
                setLightMode={setLightMode}
              />
            </div>

            {/* Mobile wallet */}
            <div className="md:hidden">
              <PrivyConnectWallet
                type="mobile"
                citizenContract={citizenContract}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 bg-gradient-to-br from-gray-900/95 via-blue-900/40 to-purple-900/30 backdrop-blur-xl border-t border-white/10">
          {navigation.filter(item => item && item.name !== 'Join').map((item, i) => {
            if (!item) return null
            
            const isActive = 
              router.pathname === item.href ||
              item.children?.some((child: any) => router.pathname === child.href)

            return (
              <div key={i}>
                {item.children ? (
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <Link
                        href={item.href || '#'}
                        className={`flex items-center flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {t(item.name)}
                      </Link>
                      <button
                        className="p-2 text-gray-300 hover:text-white transition-colors"
                        onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                      >
                        <ChevronDownIcon className={`w-3 h-3 transition-transform ${
                          openDropdown === item.name ? 'rotate-180' : ''
                        }`} />
                      </button>
                    </div>
                    {openDropdown === item.name && (
                      <div className="ml-6 space-y-1">
                        {item.children.map((child: any, j: number) => {
                          if (!child.href) {
                            return (
                              <div key={j} className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wider">
                                {child.name}
                              </div>
                            )
                          }
                          
                          const isChildActive = router.pathname === child.href

                          return (
                            <Link
                              key={j}
                              href={child.href}
                              className={`block px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                isChildActive
                                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                                  : 'text-gray-300 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {t(item.name)}
                  </Link>
                )}
              </div>
            )
          })}
          
          {/* Mobile settings */}
          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-center space-x-4">
            <LanguageChange />
            <ColorsAndSocials
              lightMode={lightMode}
              setLightMode={setLightMode}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar
