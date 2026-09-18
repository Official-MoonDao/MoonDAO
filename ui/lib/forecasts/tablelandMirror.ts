import ForecastsABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import { prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { forecastTableHandle } from '@/lib/forecasts/displayName'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import queryTable from '@/lib/tableland/queryTable'
import { getChainById } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

function isSafeHandle(handle: string): boolean {
  return /^[a-f0-9]{16}$/.test(handle)
}

function isSafeSlug(slug: string): boolean {
  return /^(sepolia|arbitrum|arbitrum-sepolia)$/.test(slug)
}

export async function mirrorForecastToTableland(input: {
  chainSlug: string
  chainId: number
  deprizeId: number
  userId: string
  vector: number[]
  displayName: string
  updatedAtMs: number
}): Promise<{ ok: boolean; skipped?: string }> {
  const tableName = FORECASTS_TABLE_NAMES[input.chainSlug] ?? ''
  const address = FORECASTS_TABLE_ADDRESSES[input.chainSlug] ?? ''
  if (!tableName || !address) return { ok: true, skipped: 'unconfigured' }
  if (!isSafeSlug(input.chainSlug)) return { ok: false, skipped: 'bad-slug' }

  const handle = forecastTableHandle(input.userId)
  if (!isSafeHandle(handle)) return { ok: false, skipped: 'bad-handle' }

  const chain = getChainById(input.chainId)
  if (!chain) return { ok: true, skipped: 'unknown-chain' }

  let exists = false
  try {
    const rows = await queryTable(
      chain as any,
      `SELECT id FROM ${tableName} WHERE chainSlug = '${input.chainSlug}' AND deprizeId = ${input.deprizeId} AND forecaster = '${handle}' LIMIT 1`
    )
    exists = Array.isArray(rows) && rows.length > 0
  } catch (err) {
    console.error('[forecasts] tableland preflight failed', err)
    return { ok: false }
  }

  try {
    const account = await createHSMWallet()
    const contract = getContract({
      client: serverClient,
      chain,
      address,
      abi: (ForecastsABI as { abi: any }).abi,
    })
    const params = [
      input.chainSlug,
      BigInt(input.deprizeId),
      handle,
      JSON.stringify(input.vector),
      input.displayName,
      BigInt(Math.floor(input.updatedAtMs / 1000)),
    ]
    const transaction = prepareContractCall({
      contract,
      method: (exists ? 'updateRow' : 'insertRow') as string,
      params,
    })
    await sendAndConfirmTransaction({ transaction, account })
    return { ok: true }
  } catch (err) {
    console.error('[forecasts] tableland mirror failed', err)
    return { ok: false }
  }
}
