import moment from 'moment'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const ETH_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'

const POLYGON_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney-l2/v0.0.1'

const ARB_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney-arb/v0.0.1'

const BASE_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney-base/v0.0.1'

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

const BaseClient: any = createClient({
  url: BASE_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

function calcVMOONEY(mooney: any, locktime: any) {
  return Math.sqrt(mooney * ((locktime - now) / (4 * 365 * 86400)))
}

function mapHolders(data: any, totalHolders: number) {
  if (data?.holders?.length < 1) return { holders: [], totalVMooney: 0 }

  let totalVMooney = 0

  const holders = data?.holders?.map((h: any) => {
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

  holders?.forEach((holder: any) => {
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

  return Object?.values(holderMap) || []
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
  let totalMooney = 0

  const ethRes = await EthClient.query(query).toPromise()
  const polygonRes = await PolygonClient.query(query).toPromise()
  const arbRes = await ArbClient.query(query).toPromise()
  const baseRes = await BaseClient.query(query).toPromise()
  const ethData = mapHolders(ethRes?.data, totalHolders)
  const ethVMooney = ethData?.totalVMooney
  const ethMooney = (ethRes?.data?.supplies[0]?.supply || 0) / 10 ** 18
  totalVMooney += ethVMooney
  totalMooney += ethMooney
  const ethHolders = ethData?.holders

  const polygonData = mapHolders(polygonRes?.data, totalHolders)
  const polygonVMooney = polygonData?.totalVMooney
  const polygonMooney = (polygonRes?.data?.supplies[0]?.supply || 0) / 10 ** 18
  totalVMooney += polygonVMooney
  totalMooney += polygonMooney
  const polygonHolders = polygonData?.holders

  const arbData = mapHolders(arbRes?.data, totalHolders)
  const arbVMooney = arbData?.totalVMooney
  const arbMooney = (arbRes?.data?.supplies[0]?.supply || 0) / 10 ** 18
  totalVMooney += arbVMooney
  totalMooney += arbMooney
  const arbHolders = arbData?.holders

  const baseData = mapHolders(baseRes?.data, totalHolders)
  const baseVMooney = baseData?.totalVMooney
  const baseMooney = (baseRes?.data?.supplies[0]?.supply || 0) / 10 ** 18
  totalVMooney += baseVMooney
  totalMooney += baseMooney
  const baseHolders = baseData?.holders

  const allHolders = [
    ...ethHolders,
    ...polygonHolders,
    ...arbHolders,
    ...baseHolders,
  ]
  const combinedHolders = combineHolders(allHolders)

  const holdersByVMooney = [...combinedHolders].sort(
    (a, b) => b.totalvMooney - a.totalvMooney
  )

  return {
    holders: combinedHolders,
    holdersByVMooney,
    totals: {
      all: {
        vMooney: totalVMooney,
        Mooney: totalMooney,
      },
      ethereum: {
        vMooney: ethVMooney,
        Mooney: ethMooney,
      },
      polygon: {
        vMooney: polygonVMooney,
        Mooney: polygonMooney,
      },
      arbitrum: {
        vMooney: arbVMooney,
        Mooney: arbMooney,
      },
      base: {
        vMooney: baseVMooney,
        Mooney: baseMooney,
      },
    },
  }
}
