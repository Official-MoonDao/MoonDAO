import { useEffect, useState } from 'react'
import { Chain, getContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'

interface useContractProps {
  chain: Chain
  address: string
  abi: any
}
export default function useContract({ chain, address, abi }: useContractProps) {
  const [contract, setContract] = useState<any>()
  useEffect(() => {
    if (chain && address && abi) {
      const contract = getContract({
        client,
        chain,
        address,
        abi,
      })
      setContract(contract)
    }
  }, [chain, address, abi])
  return contract
}
