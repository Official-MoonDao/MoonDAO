import moment from 'moment'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const ETH_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'

const POLYGON_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney-l2/v0.0.1'

const ARB_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney-arb/v0.0.1'

const now = new Date().getTime() / 1000

const EthClient: any = createClient({
  url: ETH_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

const PolygonClient: any = createClient({
  url: POLYGON_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

const ArbClient: any = createClient({
  url: ARB_SUBGRAPH_URL,
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

  const EthRes = await EthClient.query(query).toPromise()
  const PolygonRes = await PolygonClient.query(query).toPromise()
  const ArbRes = await ArbClient.query(query).toPromise()

  const holders = EthRes.data.holders.map((h: any, i: number, arr: any) => {
    totalHolders++
    const polygonHolder = PolygonRes.data.holders.find(
      (pH: any) => pH.address === h.address
    )

    const arbHolder = ArbRes.data.holders.find(
      (aH: any) => aH.address === h.address
    )

    const ethMooney = h.totalLocked / 10 ** 18
    const ethVMooney = calcVMOONEY(ethMooney, h.locktime)

    const polygonMooney = polygonHolder.totalLocked / 10 ** 18
    const polygonVMooney = calcVMOONEY(polygonMooney, polygonHolder.locktime)

    const arbMooney = arbHolder.totalLocked / 10 ** 18
    const arbVMooney = calcVMOONEY(arbMooney, arbHolder.locktime)

    const holderTotalMooney = ethMooney + polygonMooney + arbMooney
    const holderTotalVMooney = ethVMooney + polygonVMooney + arbVMooney

    const holder = {
      x: moment.unix(h.initialLock).format('YYYY-MM-DD HH:mm'),
      y: totalHolders,
      id: `${h.id.slice(0, 4)}...${h.id.slice(-4)}`,
      address: h.id,
      totalLocked: holderTotalMooney,
      totalvMooney: holderTotalVMooney,
    }
    totalVMooney += holderTotalVMooney

    return holder
  })
  const holdersByVMooney = [...holders].sort(
    (a, b) => b.totalvMooney - a.totalvMooney
  )
  const totalLockedMooney =
    EthRes.data.supplies[0].supply / 10 ** 18 +
    PolygonRes.data.supplies[0].supply / 10 ** 18 +
    ArbRes.data.supplies[0].supply / 10 ** 18
  return {
    holders,
    holdersByVMooney,
    totals: {
      vMooney: totalVMooney,
      Mooney: totalLockedMooney,
    },
  }
}
