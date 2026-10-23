const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1200

type MinimalResponse = { ok: boolean; json: () => Promise<any> }
type FetchImpl = (url: string, init?: any) => Promise<MinimalResponse>

/**
 * Mint timestamps (token id → unix seconds) for the most recent mints of an
 * NFT contract, from Etherscan's token-transfer list.
 *
 * Unlike getRecentCitizenTransfers, which returns [] on any error, this
 * returns null when the answer is unknown. The site's Etherscan key allows
 * 3 calls/sec and is shared with every other route, so a rate-limited reply
 * is common; reading it as "no recent mints" would drop new citizens from
 * the summary. Rate-limit replies are retried after a short wait.
 */
export async function fetchMintTimestamps(params: {
  contractAddress: string
  chainId: number
  apiKey: string | undefined
  limit?: number
  fetchImpl?: FetchImpl
  sleep?: (ms: number) => Promise<void>
}): Promise<Record<string, number> | null> {
  const { contractAddress, chainId, apiKey } = params
  if (!contractAddress || !apiKey) return null
  const doFetch: FetchImpl = params.fetchImpl || (fetch as unknown as FetchImpl)
  const sleep = params.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  const url =
    `https://api.etherscan.io/v2/api?module=account&action=tokennfttx` +
    `&contractaddress=${contractAddress}&page=1&offset=${params.limit ?? 50}&sort=desc` +
    `&chainid=${chainId}&apikey=${apiKey}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let json: any
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(5000) })
      json = await res.json()
    } catch {
      json = null
    }

    if (json?.status === '1' && Array.isArray(json.result)) {
      const mints: Record<string, number> = {}
      for (const tx of json.result) {
        if (tx?.from !== ZERO_ADDRESS || !tx.tokenID || !tx.timeStamp) continue
        if (!(tx.tokenID in mints)) mints[tx.tokenID] = Number(tx.timeStamp)
      }
      return mints
    }
    // Etherscan answers "No transactions found" with status 0 and an empty list.
    if (json?.status === '0' && Array.isArray(json.result) && json.result.length === 0) {
      return {}
    }

    const rateLimited = typeof json?.result === 'string' && /rate limit/i.test(json.result)
    if (!rateLimited && json !== null) return null
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS)
  }
  return null
}
