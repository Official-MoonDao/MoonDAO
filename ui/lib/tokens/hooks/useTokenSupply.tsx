import { useEffect, useState } from 'react'

export default function useTokenSupply(tokenContract: any, decimals: number) {
  const [tokenSupply, setTokenSupply] = useState<number>(0)

  useEffect(() => {
    async function getSupply() {
      if (!tokenContract) return
      const supply = await tokenContract.call('totalSupply')
      setTokenSupply(+supply.toString() / 10 ** decimals)
    }

    getSupply()
  }, [tokenContract])
  return tokenSupply
}
