/**
 * Etherscan V2 log fetch used by `/api/deprize/logs` and the DePrize
 * reconciliation job. One key covers every supported chain.
 */

export type EtherscanLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string // hex
  timeStamp: string // hex seconds
  logIndex: string // hex
  transactionHash: string
}

export const ETHERSCAN_LOGS_PAGE = 1000
export const ETHERSCAN_LOGS_MAX_PAGES = 10
export const ETHERSCAN_SUPPORTED_CHAINS = new Set([1, 11155111, 42161, 421614])

export function etherscanApiKey(): string | undefined {
  return (
    process.env.ETHERSCAN_API_KEY ||
    process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
    process.env.ARBISCAN_API_KEY ||
    undefined
  )
}

export async function fetchEtherscanV2Logs(args: {
  chainId: number
  address: string
  fromBlock: number
  toBlock: number | 'latest'
  topic0: string
  topic1?: string
  apiKey: string
}): Promise<{ logs: EtherscanLog[]; truncated: boolean }> {
  const logs: EtherscanLog[] = []
  let truncated = false
  for (let page = 1; page <= ETHERSCAN_LOGS_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      chainid: String(args.chainId),
      module: 'logs',
      action: 'getLogs',
      address: args.address,
      fromBlock: String(args.fromBlock),
      toBlock: String(args.toBlock),
      topic0: args.topic0,
      page: String(page),
      offset: String(ETHERSCAN_LOGS_PAGE),
      apikey: args.apiKey,
    })
    if (args.topic1) {
      params.set('topic0_1_opr', 'and')
      params.set('topic1', args.topic1)
    }
    const response = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`)
    const json: any = await response.json()
    if (json?.status !== '1') {
      if (typeof json?.message === 'string' && /no records/i.test(json.message)) break
      throw new Error(json?.result || json?.message || 'Explorer error')
    }
    const batch = Array.isArray(json.result) ? (json.result as EtherscanLog[]) : []
    logs.push(...batch)
    if (batch.length < ETHERSCAN_LOGS_PAGE) break
    if (page === ETHERSCAN_LOGS_MAX_PAGES) truncated = true
  }
  return { logs, truncated }
}

export async function fetchEtherscanBlockNumber(
  chainId: number,
  apiKey: string
): Promise<number> {
  const params = new URLSearchParams({
    chainid: String(chainId),
    module: 'proxy',
    action: 'eth_blockNumber',
    apikey: apiKey,
  })
  const response = await fetch(`https://api.etherscan.io/v2/api?${params.toString()}`)
  const json: any = await response.json()
  const hex = json?.result
  if (typeof hex !== 'string' || !/^0x[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(json?.message || 'block number unavailable')
  }
  const block = Number(BigInt(hex))
  if (!Number.isInteger(block) || block < 0) {
    throw new Error('block number unavailable')
  }
  return block
}
