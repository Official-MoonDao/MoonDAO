import { mainnet } from 'viem/chains'
import { useENS } from '../../lib/utils/hooks/useENS'

function shortenAddress(address: string | undefined) {
  if (address?.length !== 42) {
    return address
  }

  return address.substring(0, 6) + '...' + address.substring(address.length - 4)
}

export function ShortAddressLink({ address }: { address: string | undefined }) {
  const {
    blockExplorers: {
      default: { url },
    },
  } = mainnet

  if (!address) {
    return <span>Anon</span>
  }

  return (
    <a href={`${url}/address/${address}`} className="break-all hover:underline">
      {shortenAddress(address)}
    </a>
  )
}

export function AddressLink({ address }: { address: string | undefined }) {
  const {
    blockExplorers: {
      default: { url },
    },
  } = mainnet
  const ens = useENS(address)

  if (!address || !ens) {
    return <ShortAddressLink address={address} />
  }

  return (
    <a href={`${url}/address/${address}`} className="break-all hover:underline">
      {ens}
    </a>
  )
}
