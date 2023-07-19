import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useSwitchChain } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'

export default function SwitchNetworkBanner({ newNetwork }: any) {
  const switchChain = useSwitchChain()

  const capitalized = (network: any) =>
    network.name.charAt(0).toUpperCase() + network.name.slice(1)

  const { t } = useTranslation('common')

  return (
    <div className="w-[355px] sm:justify-between sm:w-[390px] border border-red-500 shadow-sm shadow-red-500 bg-background-light dark:bg-background-dark text-light-text dark:text-dark-text bg-opacity-70 lg:w-full pl-3 py-1 lg:py-2 flex items-center z-10 sm:flex-row rounded-full">
      <ExclamationCircleIcon className="h-7 w-7 text-red-500 animate-pulse" />
      <p className="pl-2 text-sm max-w-[190px] font-medium font-mono lg:max-w-none">
        {t('networkBanner1')} {capitalized(newNetwork)} {t('networkBanner2')}
      </p>

      <button
        className="sm:mr-3 lg:ml-2 bg-amber-500 border shadow-sm font-medium shadow-yellow-200 border-yellow-200 border-opacity-30 text-white text-sm px-2 py-1 rounded-full transition-all duration-150 hover:scale-[1.03]"
        onClick={() => switchChain(newNetwork?.chainId)}
      >
        {t('networkButton')} {capitalized(newNetwork)}
      </button>
    </div>
  )
}
