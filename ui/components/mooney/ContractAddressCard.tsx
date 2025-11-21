import React from 'react'
import Image from 'next/image'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { getAllChainAddresses } from '@/lib/mooney/utils/contractAddresses'
import { getChainSlug } from '@/lib/thirdweb/chain'

export default function ContractAddressCard() {
  const chainAddresses = getAllChainAddresses()

  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-6 border border-white/10">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <LockClosedIcon className="h-5 w-5 text-blue-400" />
        Contract Addresses
      </h3>
      <div className="space-y-4">
        {chainAddresses.map((chainInfo) => (
          <div key={chainInfo.chain.id} className="bg-black/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Image
                src={`/icons/networks/${getChainSlug(chainInfo.chain)}.svg`}
                alt={chainInfo.chainName}
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-white font-medium">
                {chainInfo.chainName}
              </span>
            </div>
            <code
              className="text-sm break-all"
              style={{ color: chainInfo.color }}
            >
              {chainInfo.address}
            </code>
          </div>
        ))}
      </div>
    </div>
  )
}

