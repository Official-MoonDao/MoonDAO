// Tableland serves mainnet chains and testnets from different gateways.
// `TABLELAND_ENDPOINT` follows the app's default chain, which stays mainnet
// while a DePrize page is on Sepolia. A Sepolia table name 400s there.
const TABLELAND_MAINNET_CHAIN_IDS = new Set([1, 10, 137, 314, 42161, 42170])

export function tablelandQueryEndpoint(chainId: number): string {
  const host = TABLELAND_MAINNET_CHAIN_IDS.has(chainId)
    ? 'tableland.network'
    : 'testnets.tableland.network'
  return `https://${host}/api/v1/query`
}
