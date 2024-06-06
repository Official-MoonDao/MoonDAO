import useSWR from 'swr'
import { isAddress } from 'ethers/lib/utils'

interface ENSIdeaResponse {
  address: string
  name: string
  displayName: string
  avatar: string
}

export function useENS(addressOrEns: string = '', shouldFetch: boolean = true) {
  return useSWR(
    (isAddress(addressOrEns) || addressOrEns.endsWith('.eth')) && shouldFetch
      ? `https://api.ensideas.com/ens/resolve/${addressOrEns}`
      : null,
    (url) =>
      fetch(url)
        .then((r) => r.json())
        .then((j) => j as ENSIdeaResponse)
  )
}
