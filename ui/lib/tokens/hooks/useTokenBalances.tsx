import { useEffect, useState } from 'react'

export default function useTokenBalances(
  tokenContract: any,
  decimals: number,
  addresses: string[]
) {
  const [tokenBalances, setTokenBalances] = useState<any[]>([])

  useEffect(() => {
    async function getBalances() {
      if (!tokenContract) return
      const balances = await Promise.all(
        addresses.map(async (address) => {
          const balance = await tokenContract.call('balanceOf', [address])
          return +balance.toString() / 10 ** decimals
        })
      )
      setTokenBalances(balances)
    }

    getBalances()
  }, [tokenContract, addresses])
  return tokenBalances
}
