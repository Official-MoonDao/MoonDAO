import { useState, useEffect } from 'react'

export function useAssets() {
  const ASSETS_URL = process.env.NEXT_PUBLIC_ASSETS_URL as string
  const [tokens, setTokens] = useState<any>([])
  const [balanceSum, setBalanceSum] = useState<any>()
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
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
          setIsLoaded(true)
        },
        (error) => {
          setIsLoaded(true)
          setError(error)
        }
      )
  }, [])

  return { tokens, isLoaded, balanceSum, error }
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
