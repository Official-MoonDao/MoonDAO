import { Bars3BottomLeftIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { PrivyConnectWallet } from '../../privy/PrivyConnectWallet'
import ColorsAndSocials from './ColorsAndSocials'
import LanguageChange from './LanguageChange'

interface MobileMenuTop {
  setSidebarOpen: Function
  lightMode: boolean
  setLightMode: Function
  citizenContract: any
  isFullscreen: boolean
}

const MobileMenuTop = ({
  setSidebarOpen,
  lightMode,
  setLightMode,
  citizenContract,
  isFullscreen,
}: MobileMenuTop) => {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Handle scroll behavior - more responsive on mobile
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Show navbar if at top of page
      if (currentScrollY < 10) {
        setIsVisible(true)
      }
      // Hide when scrolling down, show when scrolling up (reduced threshold for mobile)
      else if (currentScrollY > lastScrollY && currentScrollY > 30) {
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
      <div className="max-w-full mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-16 min-w-0">
          <button
            type="button"
            className="flex-shrink-0 px-2 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors duration-200"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3BottomLeftIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="ml-2 w-full flex justify-center items-center">
            <PrivyConnectWallet type="mobile" citizenContract={citizenContract} />
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <LanguageChange />
            <ColorsAndSocials lightMode={lightMode} setLightMode={setLightMode} />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default MobileMenuTop
