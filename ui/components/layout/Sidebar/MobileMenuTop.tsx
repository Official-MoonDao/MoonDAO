import { Bars3BottomLeftIcon } from '@heroicons/react/24/outline'
import { PrivyConnectWallet } from '../../privy/PrivyConnectWallet'
import ColorsAndSocials from './ColorsAndSocials'
import LanguageChange from './LanguageChange'

interface MobileMenuTop {
  setSidebarOpen: Function
  lightMode: boolean
  setLightMode: Function
  citizenContract: any
  isFullscreen: boolean
  showOnMd?: boolean // New prop to control md screen visibility
}

const MobileMenuTop = ({
  setSidebarOpen,
  lightMode,
  setLightMode,
  citizenContract,
  isFullscreen,
  showOnMd = false,
}: MobileMenuTop) => {
  return (
    <div
      className={`relative z-10 flex flex-1 flex-col ${
        isFullscreen ? '' : showOnMd ? '' : 'md:hidden'
      }`}
    >
      <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 justify-between bg-white shadow dark:bg-slate-950">
        <button
          type="button"
          className={`px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-gray-600 dark:focus:text-moon-indigo ${
            isFullscreen ? '' : showOnMd ? '' : 'md:hidden'
          }`}
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3BottomLeftIcon
            className="h-6 w-6 dark:fill-current dark:text-gray-100"
            aria-hidden="true"
          />
        </button>
        <div className="ml-2 w-full flex justify-center items-center">
          <PrivyConnectWallet type="mobile" citizenContract={citizenContract} />
        </div>
        <div className={`flex items-center ${isFullscreen && 'mr-8'}`}>
          <LanguageChange />

          <ColorsAndSocials lightMode={lightMode} setLightMode={setLightMode} />
        </div>
      </div>
    </div>
  )
}

export default MobileMenuTop
