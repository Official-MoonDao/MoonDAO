import useSWR from 'swr'
import { isAddress } from 'ethers/lib/utils'

interface ENSIdeaResponse {
  address: string
  name: string
  displayName: string
  avatar: string
}

export function useENS(
  addressOrEns: string | null | undefined,
  shouldFetch: boolean = true
) {
  const addressIsValid =
    !!addressOrEns && (isAddress(addressOrEns) || addressOrEns.endsWith('.eth'))
  const _shouldFetch = shouldFetch && addressIsValid

  return useSWR(
    _shouldFetch
      ? `https://api.ensideas.com/ens/resolve/${addressOrEns.toLowerCase()}`
      : null,
    (url) =>
      fetch(url)
        .then((r) => r.json())
        .then((j) => j as ENSIdeaResponse)
  )
}
