import { ZERO_ADDRESS, THIRDWEB_ENGINE_URL } from 'const/config'

export type EngineReadParams = {
  contractAddress: string
  method: string
  params: any[]
  abi: any
}

export type EngineReadOptions = {
  chainId: number
  multicall?: boolean
  from?: string
}

/**
 * Execute multiple contract reads in a single Engine API call
 * This is more efficient than individual RPC calls
 */
export async function engineMulticall<T = any>(
  params: EngineReadParams[],
  options: EngineReadOptions
): Promise<T[]> {
  if (!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET) {
    throw new Error('NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET is not configured')
  }

  const response = await fetch(THIRDWEB_ENGINE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-secret-key': process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET,
    },
    body: JSON.stringify({
      readOptions: {
        chainId: options.chainId,
        multicall: options.multicall ?? true,
        from: options.from ?? ZERO_ADDRESS,
      },
      params,
    }),
  })

  if (!response.ok) {
    throw new Error(`Engine API error: ${response.status} ${response.statusText}`)
  }

  const jsonResponse = await response.json()
  return jsonResponse.result
}

/**
 * Read a single contract method for multiple addresses/IDs
 * Useful for batch checking balances, expirations, etc.
 */
export async function engineBatchRead<T = any>(
  contractAddress: string,
  method: string,
  paramsList: any[][],
  abi: any,
  chainId: number
): Promise<T[]> {
  const params: EngineReadParams[] = paramsList.map((args) => ({
    contractAddress,
    method,
    params: args,
    abi,
  }))

  const results = await engineMulticall<{ result: string }>(params, { chainId })
  return results.map((r) => r.result as T)
}

/**
 * Read the same method across multiple contracts
 * Useful for checking balances across multiple tokens
 */
export async function engineBatchReadAcrossContracts<T = any>(
  contractAddresses: string[],
  method: string,
  paramsPerContract: any[][],
  abi: any,
  chainId: number
): Promise<T[]> {
  if (contractAddresses.length !== paramsPerContract.length) {
    throw new Error('Contract addresses and params arrays must have the same length')
  }

  const params: EngineReadParams[] = contractAddresses.map((address, i) => ({
    contractAddress: address,
    method,
    params: paramsPerContract[i],
    abi,
  }))

  const results = await engineMulticall<{ result: string }>(params, { chainId })
  return results.map((r) => r.result as T)
}
