import { getAccessToken } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import cleanData from '@/lib/tableland/cleanData'
import waitForResponse from '@/lib/typeform/waitForResponse'

/**
 * Estimates gas for a transaction using the gas estimation API
 */
export async function estimateGasWithAPI(params: {
  chainId: number
  from: string
  to: string
  data: string
  value: string
}): Promise<bigint> {
  const response = await fetch('/api/rpc/estimate-gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`Gas estimation API returned ${response.status}`)
  }

  const data = await response.json()
  if (data.error) throw new Error(data.error)

  return BigInt(data.gasEstimate)
}

/**
 * Applies a buffer percentage to a gas estimate
 */
export function applyGasBuffer(gasEstimate: bigint, bufferPercent: number): bigint {
  return (gasEstimate * BigInt(bufferPercent)) / BigInt(100)
}

/**
 * Calculates total mint cost including gas and optional cross-chain fees
 */
export function calculateTotalMintCost(
  renewalCost: bigint,
  gasEstimate: bigint,
  gasPrice: bigint,
  options?: { crossChainFee?: bigint }
): number {
  const gasCostWei = gasEstimate * gasPrice
  const gasCostEth = Number(gasCostWei) / 1e18
  let totalCost = Number(ethers.utils.formatEther(renewalCost)) + gasCostEth

  if (options?.crossChainFee) {
    totalCost += Number(options.crossChainFee) / 1e18
  }

  return totalCost
}

/**
 * Extracts token ID from a transaction receipt by parsing the Transfer event
 */
export function extractTokenIdFromReceipt(receipt: any): string | null {
  if (!receipt?.logs) return null

  const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)')
  const transferLog = receipt.logs.find((log: any) => log.topics[0] === transferEventSignature)

  if (!transferLog) return null

  return ethers.BigNumber.from(transferLog.topics[3]).toString()
}

/**
 * Handles Typeform submission with data formatting and cleaning
 */
export async function handleTypeformSubmission(params: {
  formId: string
  responseId: string
  formatter: (answers: any, responseId: string) => any
}): Promise<any> {
  await waitForResponse(params.formId, params.responseId)

  const accessToken = await getAccessToken()

  const response = await fetch('/api/typeform/response', {
    method: 'POST',
    body: JSON.stringify({
      accessToken,
      responseId: params.responseId,
      formId: params.formId,
    }),
  })

  if (!response.ok) {
    throw new Error(`API call failed with status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.answers) {
    throw new Error('No answers found in response')
  }

  const formattedData = params.formatter(data.answers, params.responseId)
  return cleanData(formattedData)
}
