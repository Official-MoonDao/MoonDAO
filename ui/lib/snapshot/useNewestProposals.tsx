import { useEffect, useState } from 'react'
import { snapshotClient } from './snapshotClient'

export function useNewestProposals(numberOfProposals: number = 3) {
  const [proposals, setProposals] = useState<any>()

  async function getNewestProposals() {
    const query = `
query {
    proposals (
      first: ${numberOfProposals},
      skip: 0,
      where: {
        space_in: ["tomoondao.eth"],
      },
      orderBy: "created",
      orderDirection: desc
    ) {
      id
      title
      body
      state
      choices
      start
      end
      snapshot
      state
      scores
      scores_by_strategy
      scores_total
      scores_updated
      author
      space {
        id
        name
      }
    }
  }
`
    // fetch proposals
    const res = await snapshotClient.query(query).toPromise()
    setProposals(res.data.proposals)
  }

  useEffect(() => {
    getNewestProposals()
  }, [])

  return proposals
}
