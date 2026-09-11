import { isHexAddress } from './eligibility'

/**
 * Wallets that must not place new bets: the current oracle / admin EOA and the
 * MoonDAO treasuries that can move prize-path funds. Extra addresses can be
 * appended with DEPRIZE_INSIDER_WALLETS (comma-separated) without a deploy.
 *
 * This is the off-chain insider blocklist. A DePrizeMint-level list still
 * needs a mint upgrade (G2 / GTM leftover).
 */
export const DEPRIZE_INSIDER_WALLETS = [
  '0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011', // deployer, CTF oracle, proxy owner
  '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9', // MoonDAO Ethereum treasury
  '0xAF26a002d716508b7e375f1f620338442F5470c0', // MoonDAO Arbitrum treasury
  '0x8C0252c3232A2c7379DDC2E44214697ae8fF097a', // MoonDAO L2 treasury
] as const

function extraInsiderWallets(): string[] {
  const raw = process.env.DEPRIZE_INSIDER_WALLETS || ''
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(isHexAddress)
}

export function isInsiderWallet(wallet: string | null | undefined): boolean {
  if (!wallet || !isHexAddress(wallet)) return false
  const needle = wallet.toLowerCase()
  if (DEPRIZE_INSIDER_WALLETS.some((addr) => addr.toLowerCase() === needle)) return true
  return extraInsiderWallets().some((addr) => addr.toLowerCase() === needle)
}
