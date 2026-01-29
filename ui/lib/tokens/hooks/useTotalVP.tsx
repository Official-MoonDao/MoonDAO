import VMOONEY_ABI from 'const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES } from 'const/config'
import request, { gql } from 'graphql-request'
import useSWR from 'swr'
import { getContract, readContract } from 'thirdweb'
import { sepolia } from '@/lib/rpc/chains'
import client from '@/lib/thirdweb/client'

export function useTotalVP(address: string) {
  const shouldFetch = address && address !== ''

  const { data, error } = useSWR(
    shouldFetch ? `vp-${address}-${process.env.NEXT_PUBLIC_CHAIN}` : null,
    async () => {
      if (process.env.NEXT_PUBLIC_CHAIN === 'mainnet') {
        const query = gql`
        {
          vp (voter: "${address}", space: "tomoondao.eth") {
            vp
          }
        }`
        const { vp } = (await request(`https://hub.snapshot.org/graphql`, query)) as any
        return vp.vp
      } else {
        const vMooneyContract = getContract({
          address: VMOONEY_ADDRESSES['sepolia'],
          chain: sepolia,
          client,
          abi: VMOONEY_ABI as any,
        })
        const vMooneyBalance = await readContract({
          contract: vMooneyContract,
          method: 'balanceOf' as any,
          params: [address],
        })
        return Math.sqrt(Number(vMooneyBalance.toString()) / 1e18)
      }
    }
  )

  return {
    walletVP: data,
    isLoading: !error && !data && shouldFetch,
    isError: !!error,
  }
}

const fetcher = (query: string) => request(`https://hub.snapshot.org/graphql`, query)

export function useTotalVPs(addresses: string[]) {
  const shouldFetch = addresses && addresses.length > 0

  const { data, error } = useSWR(
    shouldFetch ? `vps-${addresses.join(',')}-${process.env.NEXT_PUBLIC_CHAIN}` : null,
    async () => {
      const queries = addresses.map(
        (address) => gql`
            {
              vp(voter: "${address}", space: "tomoondao.eth") {
                vp
              }
            }`
      )

      const results = []
      for (let i = 0; i < queries.length; i++) {
        try {
          const result = (await fetcher(queries[i])) as any
          results.push(result.vp.vp)
          if (i < queries.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        } catch (err) {
          console.warn(`Failed to fetch VP for address ${addresses[i]}:`, err)
          results.push(0) // Fallback to 0 if individual request fails
        }
      }
      return results
    }
  )

  return {
    walletVPs: data || [], // Return cached data or empty array while loading
    isLoading: !error && !data && shouldFetch, // Loading state
    isError: !!error, // Error state
  }
}
