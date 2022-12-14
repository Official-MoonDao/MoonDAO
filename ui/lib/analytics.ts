import { Client } from '@urql/core'
import moment from 'moment'
import { createClient } from 'urql'
import ERC20 from '../abis/ERC20.json'
import { useMOONEYBalance } from './mooney-token'
import { useContractRead } from './use-wagmi'
import { useContractWrite } from './use-wagmi'

const APIURL = 'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'
const client: any = createClient({
  url: APIURL,
})
function calcVMOONEY(mooney: number, locktime: number) {
  const now = new Date().getTime() / 1000
  return mooney * ((locktime - now) / (4 * 365 * 86400))
}
//cannot query id of holder directly from the graph(wip)

export async function getSubgraph() {
  const query = `
    query {
        holders(first: 1000) {
            id
            totalLocked
            locktime
            initialLock
          }
    }
    `
  const res = await client.query(query).toPromise()
  const holders = res.data.holders.map((h: any) => {
    const mooney = h.totalLocked / 10 ** 18
    const vmooney = calcVMOONEY(h.totalLocked, h.locktime)
    return {
      id: `${h.id.slice(0, 4)}...${h.id.slice(-4)}`,
      address: h.id,
      lockedMooney: mooney,
      totalVMooney: vmooney,
      locktime: h.locktime / (3600 * 24) + ' days',
      initialLock: moment.unix(h.locktime).format('YYYY-MM-DD'),
    }
  })
  return holders
}
