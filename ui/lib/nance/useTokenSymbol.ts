import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import client from '@/lib/thirdweb/client'
import { isAddress } from 'ethers/lib/utils'
import { ETH_MOCK_ADDRESS } from '@/components/nance/form/SafeTokenForm'

export function useTokenSymbol(address: string | undefined) {
  const [value, setValue] = useState<string>('Token')
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function getValue() {
    const isValidAddress = address !== undefined && isAddress(address)

    if (address === ETH_MOCK_ADDRESS) {
      setValue('ETH')
      setIsLoading(false)
      setError(undefined)
      return
    }

    if (isValidAddress) {
      try {
        setIsLoading(true)
        setValue('Token')
        setError(undefined)

        const contract = getContract({
          client,
          address,
          chain: ethereum,
          abi: '[{"type":"function","name":"symbol","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"string"}]}]' as any,
        })

        const tokenSymbol = await readContract({
          contract,
          method: 'symbol',
        })

        setValue(tokenSymbol)
      } catch (e: any) {
        setError(e.message || e.reason)
      } finally {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (address) getValue()
  }, [address])

  return { value, error, isLoading }
}
