import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import { useWallets } from './useWallets'

export default function useTokenBalances(
  tokenContract: any,
  decimals: number,
  addresses: string[]
) {
  const [tokenBalances, setTokenBalances] = useState<any[]>([])

  useEffect(() => {
    async function getBalances() {
      const balances = await Promise.all(
        addresses.map(async (address) => {
          const balance = await tokenContract.call('balanceOf', [address])
          return +balance.toString() / 10 ** decimals
        })
      )
      setTokenBalances(balances)
    }

    getBalances()
  }, [])
  return tokenBalances
}
