import { useEffect, useState } from 'react'
import { readContract, ThirdwebContract } from 'thirdweb'

type useReadProps = {
  contract: ThirdwebContract
  method: string
  params: any[]
  deps?: any[]
}
export default function useRead({
  contract,
  method,
  params,
  deps,
}: useReadProps) {
  const [data, setData] = useState<any>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  useEffect(() => {
    async function read() {
      setIsLoading(true)
      try {
        const data = await readContract({
          contract: contract,
          method: method as any,
          params: params,
        })
        setData(data)
      } catch (err) {
        console.log(err)
      }
      setIsLoading(false)
    }
    if (contract && method && params) read()
  }, [contract, JSON.stringify(params), method, ...(deps || [])])
  return { data, isLoading }
}
