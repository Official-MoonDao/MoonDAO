import { useState, useEffect } from 'react'

export function useAssets() {
  const ASSETS_URL = process.env.NEXT_PUBLIC_ASSETS_URL as string
  const [tokens, setTokens] = useState<any>([])
  const [balanceSum, setBalanceSum] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    setIsLoading(true)
    fetch(ASSETS_URL)
      .then((res) => res.json())
      .then(
        (result) => {
          if (result.error) {
            setError(true)
            return
          }

          const [balanceSum, tokens] = transformAssets(result)

          setBalanceSum(balanceSum)
          setTokens(tokens)
          setIsLoading(false)
        },
        (error) => {
          setIsLoading(false)
          setError(error)
        }
      )
  }, [])

  return { tokens, isLoading, balanceSum, error }
}

function transformAssets(result: any) {
  let tokenArr: any = []
  let balanceSum = 0.0
  balanceSum = parseFloat(result.fiatTotal)

  result.items.forEach((token: any) => {
    //Discounting the value of MOONEY.
    if (token.tokenInfo.name === 'MOONEY') balanceSum -= token.fiatBalance

    tokenArr.push({
      balance:
        parseFloat(token.balance) / 10 ** parseFloat(token.tokenInfo.decimals),
      symbol: token.tokenInfo.symbol,
      usd: parseFloat(token.fiatBalance),
      address: token.tokenInfo.address,
    })
  })

  return [
    balanceSum
      .toFixed(2)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    tokenArr,
  ]
}
