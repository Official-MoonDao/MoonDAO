import { mainnet } from 'viem/chains'

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
  // const { data: ens } = useEnsName({
  //   address: address as Address | undefined,
  // })

  return <ShortAddressLink address={address} />

  // if (!address || !ens) {
  //   return <ShortAddressLink address={address} />
  // }

  // return (
  //   <a href={`${url}/address/${address}`} className="break-all hover:underline">
  //     {ens}
  //   </a>
  // )
}
