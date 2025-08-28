import VMOONEY_ABI from 'const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES } from 'const/config'
import request, { gql } from 'graphql-request'
import useSWR from 'swr'
import { getContract, readContract } from 'thirdweb'
import { sepolia } from '@/lib/infura/infuraChains'
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
        const { vp } = (await request(
          `https://hub.snapshot.org/graphql`,
          query
        )) as any
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
        return Number(vMooneyBalance.toString()) / 1e18
      }
    }
  )

  return {
    walletVP: data,
    isLoading: !error && !data && shouldFetch,
    isError: !!error,
  }
}

const fetcher = (query: string) =>
  request(`https://hub.snapshot.org/graphql`, query)

export function useTotalVPs(addresses: string[]) {
  const shouldFetch = addresses && addresses.length > 0

  const { data, error } = useSWR(
    shouldFetch
      ? addresses.map(
          (address) => gql`
        {
          vp(voter: "${address}", space: "tomoondao.eth") {
            vp
          }
        }`
        )
      : null,
    async (queries) => {
      const promises = queries.map(fetcher)
      const results = await Promise.all(promises)
      return results.map((result: any) => result.vp.vp)
    }
  )

  return {
    walletVPs: data || [], // Return cached data or empty array while loading
    isLoading: !error && !data, // Loading state
    isError: !!error, // Error state
  }
}
