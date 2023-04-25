import { ExclamationCircleIcon } from '@heroicons/react/outline'
import useTranslation from 'next-translate/useTranslation'
import React from 'react'
import { useNetwork } from '../../lib/use-wagmi'

const chainIds = {
  mainnet: 1,
  sepolia: 11155111,
}

type Indexable = {
  [key: string]: any
}

export default function SwitchNetworkBanner({ newNetwork }: any) {
  // @ts-expect-error
  const { switchNetwork } = useNetwork()

  const capitalized = (network: any) =>
    network.charAt(0).toUpperCase() + network.slice(1)

  const { t } = useTranslation('common')

  return (
    <div className="p-4 px-8 flex flex-col gap-4 md:flex-row justify-between md:items-center z-10">
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
        {t('networkBanner1')} {capitalized(newNetwork)} {t('networkBanner2')}
      </div>

      {/* There's a small chance the wallet used won't support switchNetwork, in which case the user needs to manually switch */}
      {/* Also check if we have specified a chain ID for the network */}
      {switchNetwork && (chainIds as Indexable)[newNetwork] && (
        <div
          className="btn btn-md btn-secondary normal-case font-medium"
          onClick={() => switchNetwork((chainIds as Indexable)[newNetwork])}
        >
          {t('networkButton')} {capitalized(newNetwork)}
        </div>
      )}
    </div>
  )
}
