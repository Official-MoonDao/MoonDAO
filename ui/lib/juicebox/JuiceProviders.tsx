'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JBProjectProvider } from 'juice-sdk-react'
import { useState, useEffect } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mainnet, arbitrum, base, sepolia } from 'wagmi/chains'
import {
  ethereum as ethereumInfura,
  arbitrum as arbitrumInfura,
  base as baseInfura,
  sepolia as sepoliaInfura,
} from '../rpc/chains'

const bendystrawKey = process.env.BENDYSTRAW_API_KEY
const bendystrawUrl = `https://${
  process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' ? 'testnet.' : ''
}bendystraw.xyz`

const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum, base, sepolia],
  transports: {
    [mainnet.id]: http(ethereumInfura.rpc),
    [arbitrum.id]: http(arbitrumInfura.rpc),
    [base.id]: http(baseInfura.rpc),
    [sepolia.id]: http(sepoliaInfura.rpc),
  },
})

const queryClient = new QueryClient()

export default function JuiceProviders({
  projectId,
  selectedChain,
  children,
}: {
  projectId: number
  selectedChain: any
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <JBProjectProvider
          projectId={BigInt(projectId)}
          chainId={selectedChain.id as any}
          version={5}
          bendystraw={{
            apiKey: bendystrawKey as string,
            url: bendystrawUrl,
          }}
        >
          {children}
        </JBProjectProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
