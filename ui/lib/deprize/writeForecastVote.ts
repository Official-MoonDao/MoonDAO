import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { tablelandQueryEndpoint } from '@/lib/tableland/endpoint'

export async function forecastVoteRowExists(args: {
  chainId: number
  forecastsTableName: string
  voteId: number
  address: string
}): Promise<boolean> {
  const addr = args.address.toLowerCase()
  const statement = `SELECT id FROM ${args.forecastsTableName} WHERE voteId = ${args.voteId} AND address = '${addr}'`
  const url = `${tablelandQueryEndpoint(args.chainId)}?statement=${encodeURIComponent(statement)}&t=${Date.now()}`
  const res = await fetch(url)
  // A failed read must not look like "no row". Tableland accepts a duplicate
  // insert without changing the existing row, so the caller would toast success.
  if (!res.ok) {
    throw new Error('Could not check your existing prediction. Try again.')
  }
  const data = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('Could not check your existing prediction. Try again.')
  }
  return data.length > 0
}

export async function writeForecastVote(args: {
  forecastsContract: any
  account: any
  forecastsTableName: string
  chainId: number
  voteId: number
  address: string
  vote: string
}): Promise<void> {
  const exists = await forecastVoteRowExists({
    chainId: args.chainId,
    forecastsTableName: args.forecastsTableName,
    voteId: args.voteId,
    address: args.address,
  })
  const method = exists ? 'updateTableCol' : 'insertIntoTable'
  const transaction = prepareContractCall({
    contract: args.forecastsContract,
    method: method as string,
    params: [BigInt(args.voteId), args.vote],
  })
  await sendAndConfirmTransaction({ transaction, account: args.account })
}

/** Erases the sender's Forecasts row. A missing row is a no-op on chain. */
export async function clearForecastVote(args: {
  forecastsContract: any
  account: any
  voteId: number
}): Promise<void> {
  const transaction = prepareContractCall({
    contract: args.forecastsContract,
    method: 'deleteFromTable' as string,
    params: [BigInt(args.voteId)],
  })
  await sendAndConfirmTransaction({ transaction, account: args.account })
}
