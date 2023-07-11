import moment from 'moment'
import { createClient } from 'urql'

const THE_GRAPH_URL =
  'https://api.studio.thegraph.com/query/38443/vmooney/v0.1.834'
const SNAPSHOT_URL = 'https://hub.snapshot.org/graphql'
const now = new Date().getTime() / 1000
function calcVMOONEY(mooney: number, locktime: number) {
  return mooney * ((locktime - now) / (4 * 365 * 86400))
}

export let TOTAL_VMOONEY = 0

export async function getSubgraph() {
  const graphClient: any = createClient({
    url: THE_GRAPH_URL,
  })
  const query = `
    query {
        holders(first: 1000, orderBy: totalLocked, orderDirection: desc) {
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
    const vmooney = calcVMOONEY(mooney, h.locktime)
    TOTAL_VMOONEY += vmooney
    return {
      address: h.id,
      lockedMooney: Math.floor(mooney),
      totalVMooney: Math.floor(vmooney),
      locktime: Math.floor((h.locktime - now) / (3600 * 24)) + ' days',
      initialLock: moment.unix(h.initialLock).format('YYYY-MM-DD'),
    }
  })
  return holders
}

export async function getSnapshot(address: any) {
  const snapshotClient: any = createClient({
    url: SNAPSHOT_URL,
  })
  const query = `
    query {
      votes (first:1000, skip:0, where:{ space: "tomoondao.eth", voter: "${address}"}){
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
  const numberOfVotes = res.data?.votes.length
  return `${numberOfVotes} ${numberOfVotes === 1 ? 'time !' : 'times !'}`
}
