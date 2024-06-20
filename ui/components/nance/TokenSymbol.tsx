import { useTokenSymbol } from '../../lib/nance/useTokenSymbol'

export function TokenSymbol({ address }: { address: string | undefined }) {
  const { value: tokenSymbol, error, isLoading } = useTokenSymbol(address)
  //console.debug('TokenSymbol', error, isLoading, address)

  return (
    <a
      href={`https://etherscan.io/address/${address}`}
      className="break-all hover:underline"
    >
      {tokenSymbol}
    </a>
  )
}
