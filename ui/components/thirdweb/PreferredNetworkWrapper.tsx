import { useChain } from '@thirdweb-dev/react'
import React, { useContext } from 'react'
import ChainContext from '../../lib/thirdweb/chain-context'
import SwitchNetworkBanner from './SwitchNetworkBanner'

export default function PreferredNetworkWrapper({ children, address }: any) {
  const chain = useChain()

  const { selectedChain } = useContext(ChainContext)

  return (
    <>
      {address && chain?.name !== selectedChain?.name && (
        <SwitchNetworkBanner newNetwork={selectedChain} />
      )}
      {children}
    </>
  )
}
