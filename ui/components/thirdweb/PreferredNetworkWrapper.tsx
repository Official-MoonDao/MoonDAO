import React, { useContext } from 'react'
import { useActiveWalletChain } from 'thirdweb/react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import SwitchNetworkBanner from './SwitchNetworkBanner'

export default function PreferredNetworkWrapper({ children, address }: any) {
  const activeWalletChain = useActiveWalletChain()
  const { selectedChain } = useContext(ChainContextV5)

  return (
    <>
      {activeWalletChain !== selectedChain && (
        <SwitchNetworkBanner newNetwork={selectedChain} />
      )}
      {children}
    </>
  )
}
