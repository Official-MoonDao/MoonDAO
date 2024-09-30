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

function mapHolders(data: any, totalHolders: number) {
  let totalVMooney = 0
  const holders = data.holders.map((h: any) => {
    totalHolders++

    const mooney = h.totalLocked / 10 ** 18
    const vmooney = calcVMOONEY(mooney, h.locktime)

    const holder = {
      x: moment.unix(h.initialLock).format('YYYY-MM-DD HH:mm'),
      y: totalHolders,
      id: `${h.id.slice(0, 4)}...${h.id.slice(-4)}`,
      address: h.id,
      totalLocked: mooney,
      totalvMooney: vmooney,
      initialLock: h.initialLock,
    }
    totalVMooney += vmooney

    return holder
  })
  return { holders, totalVMooney }
}

function combineHolders(holders: any[]) {
  const holderMap: { [key: string]: any } = {}

  holders.forEach((holder) => {
    if (holderMap[holder.address]) {
      holderMap[holder.address].totalLocked += holder.totalLocked
      holderMap[holder.address].totalvMooney += holder.totalvMooney
      holderMap[holder.address].initialLock = Math.min(
        holderMap[holder.address].initialLock,
        holder.initialLock
      )
    } else {
      holderMap[holder.address] = { ...holder }
    }
  })

  return Object.values(holderMap)
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

  const ethRes = await EthClient.query(query).toPromise()
  const polygonRes = await PolygonClient.query(query).toPromise()
  const arbRes = await ArbClient.query(query).toPromise()

  const ethData = mapHolders(ethRes.data, totalHolders)
  totalVMooney += ethData.totalVMooney
  const ethHolders = ethData.holders

  const polygonData = mapHolders(polygonRes.data, totalHolders)
  totalVMooney += polygonData.totalVMooney
  const polygonHolders = polygonData.holders

  const arbData = mapHolders(arbRes.data, totalHolders)
  totalVMooney += arbData.totalVMooney
  const arbHolders = arbData.holders

  const allHolders = [...ethHolders, ...polygonHolders, ...arbHolders]
  const combinedHolders = combineHolders(allHolders)

  const holdersByVMooney = [...combinedHolders].sort(
    (a, b) => b.totalvMooney - a.totalvMooney
  )

  const totalLockedMooney =
    (ethRes.data.supplies[0]?.supply || 0) / 10 ** 18 +
    (polygonRes.data.supplies[0]?.supply || 0) / 10 ** 18 +
    (arbRes.data.supplies[0]?.supply || 0) / 10 ** 18

  return {
    holders: combinedHolders,
    holdersByVMooney,
    totals: {
      vMooney: totalVMooney,
      Mooney: totalLockedMooney,
    },
  }
}
