import { Ethereum } from '@thirdweb-dev/chains'
import { useEffect, useState } from 'react'
import { isAddress } from 'ethers/lib/utils'
import { initSDK } from '../thirdweb/thirdweb'
import { ETH_MOCK_ADDRESS } from "../../components/nance/form/SafeTokenForm"

const ETHEREUM_SDK = initSDK(Ethereum)

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

        const contract = await ETHEREUM_SDK.getContract(
          address,
          '[{"type":"function","name":"symbol","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"string"}]}]'
        )
        const tokenSymbol = await contract.call('symbol')

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
