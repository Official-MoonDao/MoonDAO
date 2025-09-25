import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JBVersion } from 'juice-sdk-core'
import { JBProjectProvider } from 'juice-sdk-react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mainnet, arbitrum, base, sepolia } from 'wagmi/chains'

const thirdwebClientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID

const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum, base, sepolia],
  transports: {
    [mainnet.id]: http(`https://1.rpc.thirdweb.com/${thirdwebClientId}`),
    [arbitrum.id]: http(`https://42161.rpc.thirdweb.com/${thirdwebClientId}`),
    [base.id]: http(`https://8453.rpc.thirdweb.com/${thirdwebClientId}`),
    [sepolia.id]: http(`https://11155111.rpc.thirdweb.com/${thirdwebClientId}`),
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
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <JBProjectProvider
          projectId={BigInt(projectId)}
          chainId={selectedChain.id as any}
          version={5}
        >
          {children}
        </JBProjectProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
