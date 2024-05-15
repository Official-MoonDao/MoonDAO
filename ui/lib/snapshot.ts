import { gql, GraphQLClient } from 'graphql-request'
import useSWR from 'swr'

const endpoint = 'https://hub.snapshot.org/graphql'

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    'x-api-key': process.env.NEXT_PUBLIC_SNAPSHOT_API_KEY || '',
  },
})

const votesOfProposalQuery = gql`
  query votesOfProposal(
    $id: String!
    $skip: Int
    $orderBy: String
    $first: Int
  ) {
    votes(
      first: $first
      skip: $skip
      where: { proposal: $id }
      orderBy: $orderBy
      orderDirection: desc
    ) {
      id
      app
      created
      voter
      choice
      vp
      reason
    }

    proposal(id: $id) {
      id
      state
      end
      type
      choices
      scores
      votes
      quorum
      scores_total
      ipfs
      snapshot
    }
  }
`

const votingInfoOfProposalsQuery = gql`
  query ProposalsByID($first: Int, $proposalIds: [String]) {
    proposals(
      first: $first
      skip: 0
      where: { id_in: $proposalIds }
      orderBy: "created"
      orderDirection: desc
    ) {
      id
      state
      end
      type
      choices
      scores
      votes
      quorum
      scores_total
      ipfs
      snapshot
    }
  }
`

export type ProposalType =
  | 'approval'
  | 'ranked-choice' // choice = [1,2,3]
  | 'basic'
  | 'single-choice' // choice = 1
  | 'weighted'
  | 'quadratic' // choice = {"1": 1, "2": 2, "3": 3}

export type SnapshotGraphqlProposalVotingInfo = {
  id: string
  // active or
  state: string
  end: number
  // voting type
  type: ProposalType
  choices: string[]
  // scores by choice
  scores: number[]
  // vote count
  votes: number
  quorum: number
  scores_total: number
}

export type SnapshotGraphqlVote = {
  id: string
  // metadata
  app: string
  created: number
  end: number
  // voting
  voter: string
  vp: number
  reason: string
  choice: number | { [k: string]: number }
  choiceLabel?: string
  aha: string
}

export async function getVotingInfoOfProposals(
  proposalIds: string[]
): Promise<SnapshotGraphqlProposalVotingInfo[]> {
  const variable = { first: proposalIds.length, proposalIds }
  const data = await graphQLClient.request<{
    proposals: SnapshotGraphqlProposalVotingInfo[]
  }>(votingInfoOfProposalsQuery, variable)

  return data.proposals
}

export function useVotingInfoOfProposals(
  proposalIds: string[],
  shouldFetch: boolean = true
) {
  return useSWR(
    shouldFetch ? endpoint + '=> getVotingInfoOfProposals' : null,
    async (url) => getVotingInfoOfProposals(proposalIds)
  )
}

interface VotesOfProposal {
  votes: SnapshotGraphqlVote[]
  proposal: SnapshotGraphqlProposalVotingInfo
}

export async function getVotesOfProposal(
  id?: string,
  first: number = 10,
  skip: number = 0,
  orderBy: 'created' | 'vp' = 'created'
): Promise<VotesOfProposal | undefined> {
  if (!id) {
    return undefined
  }

  const variable = { id, skip, orderBy, first }
  const data = await graphQLClient.request<VotesOfProposal>(
    votesOfProposalQuery,
    variable
  )

  const votes = data.votes.map((vote) => {
    return {
      ...vote,
      choiceLabel: getChoiceLabel(
        data.proposal.type,
        data.proposal.choices,
        vote.choice
      ),
    }
  })

  return {
    votes,
    proposal: data.proposal,
  }
}

export function useVotesOfProposal(
  id?: string,
  first: number = 10,
  skip: number = 0,
  orderBy: 'created' | 'vp' = 'created',
  shouldFetch: boolean = true
) {
  return useSWR(
    shouldFetch ? endpoint + '=> getVotesOfProposal' : null,
    async (url) => getVotesOfProposal(id, first, skip, orderBy)
  )
}

// map indexed choice number to choice string
export function getChoiceLabel(
  type: ProposalType,
  choices: string[] | undefined,
  choice: number | number[] | { [key: string]: number } | undefined
): string {
  if (typeof choice === 'string') return '🔐'

  if (!type || !choices || !choice) return 'Unknown'

  if (type == 'approval') {
    // choice = [1,2,3]
    const choiceArr = choice as number[]
    return choiceArr.map((c: number) => choices[c - 1]).join(', ')
  } else if (type == 'ranked-choice') {
    // choice = [1,2,3]
    const choiceArr = choice as number[]
    return choiceArr.map((c, i) => `(${i + 1}th) ${choices[c - 1]}`).join(', ')
  } else if (['quadratic', 'weighted'].includes(type)) {
    // choice = {"1": 1, "2": 2, "3": 3}
    const choiceObj = choice as { [key: string]: number }
    const totalUnits = Object.values(choiceObj).reduce((a, b) => a + b, 0)
    return Object.entries(choiceObj)
      .map(
        ([key, value]) =>
          `${Math.round((value / totalUnits) * 100)}% for ${
            choices[parseInt(key) - 1]
          }`
      )
      .join(', ')
  } else {
    // choice = 1
    return choices[(choice as number) - 1]
  }
}
