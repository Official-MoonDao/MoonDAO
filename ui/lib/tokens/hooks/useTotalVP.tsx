import { useAddress } from '@thirdweb-dev/react'
import request, { gql } from 'graphql-request'
import { useEffect, useState } from 'react'
import useSWR from 'swr'

export function useTotalVP(address: string) {
  const [walletVP, setWalletVP] = useState<any>()

  useEffect(() => {
    async function getTotalVP() {
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
      setWalletVP(vp.vp)
    }
    if (address && address !== '') getTotalVP()
  }, [address])

  return walletVP
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
