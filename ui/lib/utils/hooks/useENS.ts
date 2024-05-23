import useSWR from 'swr'
import { isAddress } from 'ethers/lib/utils'

interface ENSIdeaResponse {
  address: string
  name: string
  displayName: string
  avatar: string
}

export function useENS(address: string = '') {
  const { data, error } = useSWR(
    isAddress(address)
      ? `https://api.ensideas.com/ens/resolve/${address}`
      : null,
    (url) =>
      fetch(url)
        .then((r) => r.json())
        .then((j) => j as ENSIdeaResponse)
  )

  return data?.name
}
