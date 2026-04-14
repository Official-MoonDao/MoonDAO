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

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY < 10) {
        setIsVisible(true)
      }
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
    <nav
      className={`fixed top-0 left-0 right-0 z-[9999] transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{
        background: 'linear-gradient(90deg, rgba(5,5,5,0.97) 0%, rgba(10,15,18,0.97) 50%, rgba(5,5,8,0.97) 100%)',
        borderBottom: '1px solid rgba(0, 255, 200, 0.25)',
        boxShadow: '0 2px 20px rgba(0, 255, 200, 0.08), inset 0 -1px 0 rgba(0, 255, 200, 0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-full mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-16 min-w-0">
          <button
            type="button"
            className="flex-shrink-0 px-2 focus:outline-none transition-colors duration-200"
            style={{ color: '#00ffc8' }}
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3BottomLeftIcon
              className="h-6 w-6"
              aria-hidden="true"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0, 255, 200, 0.3))' }}
            />
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
