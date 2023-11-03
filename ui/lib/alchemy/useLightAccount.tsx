import { LightSmartContractAccount } from '@alchemy/aa-accounts'
import { AlchemyProvider } from '@alchemy/aa-alchemy'
import { WalletClientSigner, type SmartAccountSigner } from '@alchemy/aa-core'
import { useContext, useEffect, useState } from 'react'
import { createWalletClient, custom } from 'viem'
import { polygonMumbai, polygon, mainnet } from 'viem/chains'
import PrivyWalletContext from '../privy/privy-wallet-context'

export function useLightAccount(wallets: any) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const chain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? mainnet : polygonMumbai
  const [provider, setProvider] = useState()

  async function getProvider() {
    const wallet = wallets[selectedWallet]
    // await wallet.switchChain(polygonMumbai.id)
    const eip1193Provider = await wallet.getEthereumProvider()

    const privyClient = createWalletClient({
      account: wallet.address as any,
      chain,
      transport: custom(eip1193Provider),
    })

    const privySigner: SmartAccountSigner = new WalletClientSigner(
      privyClient,
      'privy'
    )

    const provider: any = new AlchemyProvider({
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY as string,
      chain,
      entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    }).connect(
      (rpcClient) =>
        new LightSmartContractAccount({
          entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
          chain: rpcClient.chain,
          owner: privySigner,
          factoryAddress: '0x15Ba39375ee2Ab563E8873C8390be6f2E2F50232',
          rpcClient,
        })
    )

    setProvider(provider)
  }

  useEffect(() => {
    if (wallets) {
      getProvider()
    }
  }, [wallets])

  return provider
}
