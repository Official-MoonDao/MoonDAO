import moment from 'moment'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const L1_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'

const L2_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney-l2/v0.0.1'

const now = new Date().getTime() / 1000

const L1Client: any = createClient({
  url: L1_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

const L2Client: any = createClient({
  url: L2_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

function calcVMOONEY(mooney: any, locktime: any) {
  return Math.sqrt(mooney * ((locktime - now) / (4 * 365 * 86400)))
}

export async function getVMOONEYData() {
  const query: any = `
    query {
      supplies(first:1, orderBy: blockNumber, orderDirection: desc) {
        supply
        blockTimestamp
      }
      holders(first:1000, orderBy: initialLock, orderDirection: asc,  where: {locktime_gt: ${Math.round(
        now
      )}}){
            id
            totalLocked
            locktime
            initialLock
      }
      deposits(first: 1000, orderBy: blockTimestamp, where: {type_not: "3"}) {
        value
        locktime
        ts
      }
    }
    `
  let totalHolders = 0
  let totalVMooney = 0

  const L1Res = await L1Client.query(query).toPromise()
  const L2Res = await L2Client.query(query).toPromise()
  const holders = L1Res.data.holders.map((h: any, i: number, arr: any) => {
    totalHolders++
    const l2h = L2Res.data.holders.find((l2h: any) => l2h.address === h.address)

    const l1mooney = h.totalLocked / 10 ** 18
    const l1vmooney = calcVMOONEY(l1mooney, h.locktime)

    const l2mooney = l2h.totalLocked / 10 ** 18
    const l2vmooney = calcVMOONEY(l2mooney, l2h.locktime)

    const holder = {
      x: moment.unix(h.initialLock).format('YYYY-MM-DD HH:mm'),
      y: totalHolders,
      id: `${h.id.slice(0, 4)}...${h.id.slice(-4)}`,
      address: h.id,
      // locktime: moment
      //   .unix(h.locktime < l2h.locktime ? l2h.locktime : h.locktime)
      //   .format('YYYY-MM-DD'),
      totalLocked: l1mooney + l2mooney,
      totalvMooney: l1vmooney + l2vmooney,
    }
    totalVMooney += l1vmooney + l2vmooney

    return holder
  })
  const holdersByVMooney = [...holders].sort(
    (a, b) => b.totalvMooney - a.totalvMooney
  )
  const totalLockedMooney =
    L1Res.data.supplies[0].supply / 10 ** 18 +
    L2Res.data.supplies[0].supply / 10 ** 18
  return {
    holders,
    holdersByVMooney,
    totals: {
      vMooney: totalVMooney,
      Mooney: totalLockedMooney,
    },
  }
}
