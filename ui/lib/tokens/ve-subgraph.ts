import moment from 'moment'
import { cacheExchange, createClient, fetchExchange } from 'urql'

const APIURL = 'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'

const now = new Date().getTime() / 1000

const client: any = createClient({
  url: APIURL,
  exchanges: [fetchExchange, cacheExchange],
})
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
  let totalHolders = 0,
    totalVMooney = 0,
    totalStakingPeriod = 0
  const res = await client.query(query).toPromise()
  const holders = res.data.holders.map((h: any, i: number, arr: any) => {
    totalHolders++
    const mooney = h.totalLocked / 10 ** 18
    const vmooney = mooney * ((h.locktime - now) / (4 * 365 * 86400))
    const holder = {
      x: moment.unix(h.initialLock).format('YYYY-MM-DD HH:mm'),
      y: totalHolders,
      id: `${h.id.slice(0, 4)}...${h.id.slice(-4)}`,
      address: h.id,
      locktime: moment.unix(h.locktime).format('YYYY-MM-DD'),
      totalLocked: mooney,
      totalvMooney: vmooney,
    }
    totalVMooney += vmooney
    totalStakingPeriod += Number(h.locktime)
    return holder
  })
  const holdersByVMooney = [...holders].sort(
    (a, b) => b.totalvMooney - a.totalvMooney
  )
  const distribution = holders.map((h: any) => ({
    id: h.id,
    label: h.id,
    value: h.totalvMooney / totalVMooney,
  }))
  const totalLockedMooney = res.data.supplies[0].supply / 10 ** 18
  return {
    holders,
    holdersByVMooney,
    distribution,
    totals: {
      vMooney: totalVMooney,
      Mooney: totalLockedMooney,
      AvgStakingPeriod:
        Math.floor((totalStakingPeriod / holders.length - now) / (3600 * 24)) +
        ' days',
    },
  }
}
