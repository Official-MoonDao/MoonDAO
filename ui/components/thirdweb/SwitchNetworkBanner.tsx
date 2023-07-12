import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useSwitchChain } from '@thirdweb-dev/react'
import useTranslation from 'next-translate/useTranslation'
import React from 'react'

export default function SwitchNetworkBanner({ newNetwork }: any) {
  const switchChain = useSwitchChain()

  const capitalized = (network: any) =>
    network.name.charAt(0).toUpperCase() + network.name.slice(1)

  const { t } = useTranslation('common')

  console.log(newNetwork)

  return (
    <div className="absolute p-4 px-8 flex flex-col gap-4 md:flex-row justify-between md:items-center z-10">
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
        {t('networkBanner1')} {capitalized(newNetwork)} {t('networkBanner2')}
      </div>

      <div
        className="btn btn-md btn-secondary normal-case font-medium"
        onClick={() => switchChain(newNetwork?.chainId)}
      >
        {t('networkButton')} {capitalized(newNetwork)}
      </div>
    </div>
  )
}
