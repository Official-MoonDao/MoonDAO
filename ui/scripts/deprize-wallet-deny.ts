/**
 * Operator tool for the DePrize wallet deny-list.
 *
 *   yarn deprize:deny --list
 *   yarn deprize:deny --deny 0xabc... --reason "manual review"
 *   yarn deprize:deny --allow 0xabc... --reason "false positive"
 */
import { getAddress, isAddress } from 'viem'
import {
  clearWalletDenial,
  denyWallet,
  listDeniedWallets,
} from '../lib/deprize/walletObservations'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function requireAddress(raw: string | undefined, flag: string): string {
  if (!raw || !isAddress(raw)) {
    throw new Error(`${flag} requires a valid Ethereum address`)
  }
  return getAddress(raw)
}

async function main() {
  const actor = process.env.USER || process.env.LOGNAME || 'operator'
  if (process.argv.includes('--list')) {
    const denied = await listDeniedWallets()
    process.stdout.write(`${JSON.stringify(denied, null, 2)}\n`)
    return
  }

  if (process.argv.includes('--deny')) {
    const wallet = requireAddress(argValue('--deny'), '--deny')
    const reason = argValue('--reason')
    if (!reason) throw new Error('--deny requires --reason <text>')
    const result = await denyWallet(wallet, 'manual', null, actor)
    if (result.failed) throw new Error('deny write failed')
    process.stdout.write(`${JSON.stringify({ ok: true, action: 'deny', wallet, created: result.created })}\n`)
    return
  }

  if (process.argv.includes('--allow')) {
    const wallet = requireAddress(argValue('--allow'), '--allow')
    const reason = argValue('--reason')
    if (!reason) throw new Error('--allow requires --reason <text>')
    const result = await clearWalletDenial(wallet, actor, reason)
    if (result.failed) throw new Error('allow write failed')
    process.stdout.write(`${JSON.stringify({ ok: true, action: 'allow', wallet, cleared: result.cleared })}\n`)
    return
  }

  throw new Error('Usage: --list | --deny <address> --reason <text> | --allow <address> --reason <text>')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
