import { useEffect, useState } from 'react'
import { Chain, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'

interface useContractProps {
  chain: Chain
  address: string
  abi: any
  forwardClient?: any
}
export default function useContract({
  chain,
  address,
  abi,
  forwardClient,
}: useContractProps) {
  const [contract, setContract] = useState<any>()
  useEffect(() => {
    if (chain && address && abi) {
      const contract = getContract({
        client: forwardClient || client,
        chain,
        address,
        abi,
      })
      setContract(contract)
    }
  }, [chain, address, abi])
  return contract
}
