import JBV5Token from 'const/abis/JBV5Token.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import type { Chain } from 'thirdweb/chains'
import { serverClient } from '../thirdweb/client'

export type TokenData = {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  tokenSupply: string
  reservedTokens?: string
  reservedRate?: string
}

export async function fetchTokenMetadata(
  tokenAddress: string,
  chain: Chain = DEFAULT_CHAIN_V5
): Promise<TokenData> {
  const defaultTokenData: TokenData = {
    tokenAddress: tokenAddress || '',
    tokenName: '',
    tokenSymbol: '',
    tokenSupply: '',
    reservedTokens: '',
    reservedRate: '',
  }

  if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
    return defaultTokenData
  }

  try {
    const tokenContract = getContract({
      client: serverClient,
      address: tokenAddress,
      abi: JBV5Token as any,
      chain: chain,
    })

    const [nameResult, symbolResult, supplyResult] = await Promise.allSettled([
      readContract({
        contract: tokenContract,
        method: 'name' as string,
        params: [],
      }),
      readContract({
        contract: tokenContract,
        method: 'symbol' as string,
        params: [],
      }),
      readContract({
        contract: tokenContract,
        method: 'totalSupply' as string,
        params: [],
      }),
    ])

    if (nameResult.status === 'fulfilled' && nameResult.value) {
      defaultTokenData.tokenName = nameResult.value
    }
    if (symbolResult.status === 'fulfilled' && symbolResult.value) {
      defaultTokenData.tokenSymbol = symbolResult.value
    }
    if (supplyResult.status === 'fulfilled' && supplyResult.value) {
      defaultTokenData.tokenSupply = supplyResult.value.toString()
    }

    return defaultTokenData
  } catch (error) {
    console.warn('Failed to fetch token data:', error)
    return defaultTokenData
  }
}
