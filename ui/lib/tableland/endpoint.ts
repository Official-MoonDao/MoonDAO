import { TABLELAND_MAINNET_GATEWAY, TABLELAND_TESTNET_GATEWAY } from 'const/config'

// Tableland serves mainnet chains and testnets from different gateways.
// `TABLELAND_ENDPOINT` follows the app's default chain, which stays mainnet
// while a DePrize page is on Sepolia. A Sepolia table name 400s there.
const TABLELAND_MAINNET_CHAIN_IDS = new Set([1, 10, 137, 314, 42161, 42170])

export function tablelandGateway(chainId: number): string {
  return TABLELAND_MAINNET_CHAIN_IDS.has(chainId)
    ? TABLELAND_MAINNET_GATEWAY
    : TABLELAND_TESTNET_GATEWAY
}

export function tablelandQueryEndpoint(chainId: number): string {
  return `${tablelandGateway(chainId)}/api/v1/query`
}
