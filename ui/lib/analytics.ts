import { Client } from '@urql/core'
import moment from 'moment'
import { createClient } from 'urql'
import ERC20 from '../abis/ERC20.json'
import { useMOONEYBalance } from './mooney-token'
import { useContractRead } from './use-wagmi'
import { useContractWrite } from './use-wagmi'

const THE_GRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'
const SNAPSHOT_URL = 'https://hub.snapshot.org/graphql'

const now = new Date().getTime() / 1000

function calcVMOONEY(mooney: number, locktime: number) {
  return mooney * ((locktime - now) / (4 * 365 * 86400))
}

export async function getSubgraph() {
  const graphClient: any = createClient({
    url: THE_GRAPH_URL,
  })
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
  const res = await graphClient.query(query).toPromise()
  const holders = res.data.holders.map((h: any) => {
    const mooney = h.totalLocked / 10 ** 18
    const vmooney = calcVMOONEY(h.totalLocked, h.locktime)
    return {
      id: `${h.id.slice(0, 4)}...${h.id.slice(-4)}`,
      address: h.id,
      lockedMooney: mooney,
      totalVMooney: vmooney,
      locktime: h.locktime - now / 86400 + 'days',
      initialLock: moment.unix(h.locktime).format('YYYY-MM-DD'),
    }
  })
  return holders
}

export async function getSnapshot() {
  const snapshotClient: any = createClient({
    url: SNAPSHOT_URL,
  })
  const query = `
    query {
      votes (first:1000, skip:0, where:{ space: "tomoondao.eth", voter: "0x679d87D8640e66778c3419D164998E720D7495f6"}){
        id 
        voter
        vp
        created
        proposal {
          id
        }
      }
    }
  `

  const res = await snapshotClient.query(query).toPromise()
  return res.data.votes.length
}
