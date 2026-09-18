import { TABLELAND_ENDPOINT } from 'const/config'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'

export async function forecastVoteRowExists(args: {
  votesTableName: string
  voteId: number
  address: string
}): Promise<boolean | null> {
  const addr = args.address.toLowerCase()
  const statement = `SELECT id FROM ${args.votesTableName} WHERE voteId = ${args.voteId} AND address = '${addr}'`
  const url = `${TABLELAND_ENDPOINT}?statement=${encodeURIComponent(statement)}&t=${Date.now()}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) && data.length > 0
  } catch {
    return null
  }
}

export async function writeForecastVote(args: {
  votesContract: any
  account: any
  votesTableName: string
  voteId: number
  address: string
  vote: string
  knownExists?: boolean
}): Promise<void> {
  const checked = await forecastVoteRowExists({
    votesTableName: args.votesTableName,
    voteId: args.voteId,
    address: args.address,
  })
  const exists = checked != null ? checked : args.knownExists === true ? true : null
  if (exists == null) {
    throw new Error('Could not verify whether a prediction already exists.')
  }
  const method = exists ? 'updateTableCol' : 'insertIntoTable'
  const transaction = prepareContractCall({
    contract: args.votesContract,
    method: method as string,
    params: [BigInt(args.voteId), args.vote],
  })
  await sendAndConfirmTransaction({ transaction, account: args.account })
}
