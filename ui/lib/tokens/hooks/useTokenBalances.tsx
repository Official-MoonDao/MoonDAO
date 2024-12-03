import { useEffect, useState } from 'react'

export default function useTokenBalances(
  tokenContract: any,
  decimals: number,
  addresses: string[]
) {
  const [tokenBalances, setTokenBalances] = useState<number[]>([])

  useEffect(() => {
    async function getBalances() {
      if (!tokenContract || !addresses || addresses.length === 0) return

      try {
        const balances = await Promise.all(
          addresses.map(async (address) => {
            try {
              const balance = await tokenContract.balanceOf(address) // Adjust this for your library
              return +balance.toString() / 10 ** decimals
            } catch (error) {
              console.error(
                `Failed to fetch balance for address ${address}:`,
                error
              )
              return 0
            }
          })
        )
        setTokenBalances(balances)
      } catch (error) {
        console.error('Error fetching balances:', error)
      }
    }

    getBalances()
  }, [tokenContract, addresses, decimals])

  return tokenBalances
}
