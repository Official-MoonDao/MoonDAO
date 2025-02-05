//Watch a token balance of the selected wallet
import { useEffect } from 'react'
import { useActiveAccount, useWalletBalance } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'

export default function useWatchTokenBalance(
  selectedChain: any,
  tokenAddress: any
) {
  const account = useActiveAccount()
  const address = account?.address

  const { data: tokenBalance, refetch } = useWalletBalance({
    client,
    address,
    chain: selectedChain,
    tokenAddress,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 10000)
    return () => clearInterval(interval)
  }, [address])

  return Number(tokenBalance?.displayValue)
}
