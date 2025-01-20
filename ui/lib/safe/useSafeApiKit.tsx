import SafeApiKit from '@safe-global/api-kit'
import { EthersAdapter } from '@safe-global/protocol-kit'
import { useSDK } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'

export default function useSafeApiKit() {
  const sdk = useSDK()

  const [safeApiKit, setSafeApiKit] = useState<any>()

  useEffect(() => {
    const signer = sdk?.getSigner()
    if (!sdk || !signer) return

    const ethAdapter = new EthersAdapter({
      ethers,
      signerOrProvider: signer,
    })

    const safeNetwork =
      process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia'

    const txServiceUrl = `https://safe-transaction-${safeNetwork}.safe.global`

    const apiKit = new SafeApiKit({
      txServiceUrl,
      ethAdapter,
    })

    setSafeApiKit(apiKit)
  }, [sdk])

  return safeApiKit
}
