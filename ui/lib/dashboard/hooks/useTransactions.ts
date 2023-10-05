import { useState, useEffect } from 'react'

export function useTransactions(page: number) {
  // MoonDAO Multsig Wallet address.
  const MULTISIG_ADDRESS = '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9'
  const ETHERSCAN_API_BASE = 'https://api.etherscan.io/api'

  const [transactions, setTransactions] = useState<any>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>()

  function getTransactions() {
    const url =
      ETHERSCAN_API_BASE +
      `?module=account&action=tokentx&address=${MULTISIG_ADDRESS}` +
      `&page=${page}` +
      `&offset=10` +
      `&sort=desc` +
      `&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    setIsLoading(true)
    fetch(url)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === '0') {
          throw Error(result.result)
        }

        setTransactions(result.result)
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    getTransactions()
  }, [page])

  return { transactions, isLoading, error }
}
