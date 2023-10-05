import { Mumbai, Polygon } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { initSDK } from '../../../thirdweb/thirdweb'

export function useCurrBlockNum() {
  const [currBlockNum, setCurrBlockNum] = useState<number | undefined>(
    undefined
  )
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Polygon : Mumbai
  const sdk = initSDK(chain)
  useEffect(() => {
    sdk &&
      sdk
        .getProvider()
        .getBlockNumber()
        .then((blockNumber: number) => {
          setCurrBlockNum(blockNumber)
        })
  }, [sdk])
  return currBlockNum
}
