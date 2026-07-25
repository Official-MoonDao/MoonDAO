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
    // `params` is an array, so `[addr, undefined]` is truthy — but viem throws
    // while ABI-encoding any undefined/null param ("Cannot convert undefined to
    // a BigInt"). Callers pass not-yet-loaded values (e.g. projectId) on first
    // render; skip until every param is present instead of firing a doomed read.
    const paramsReady =
      Array.isArray(params) && params.every((p) => p !== undefined && p !== null)
    if (contract && method && paramsReady) read()
  }, [contract, JSON.stringify(params), method, ...(deps || [])])
  return { data, isLoading }
}
