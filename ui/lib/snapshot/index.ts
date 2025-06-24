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
      title
      state
      end
      type
      choices
      scores
      votes
      quorum
      scores_total
      privacy
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
      title
      state
      end
      type
      choices
      scores
      votes
      quorum
      scores_total
      privacy
      ipfs
      snapshot
    }
  }
`

const votingPowerQuery = gql`
  query VotingPowerQuery($voter: String!, $space: String!, $proposal: String) {
    vp(voter: $voter, space: $space, proposal: $proposal) {
      vp
      vp_by_strategy
      vp_state
    }
  }
`

const votesOfAddressQuery = gql`
  query Votes($address: String!, $skip: Int) {
    votes(
      first: 1000
      skip: $skip
      where: { voter: $address, space: "tomoondao.eth" }
    ) {
      id
      voter
      choice
      created
      space {
        id
      }
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
  title: string
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
  // privacy
  privacy: 'shutter' | ''
  // ipfs
  ipfs: string
  snapshot: string
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

export type SnapshotGraphqlVoteByAddress = {
  id: string
  voter: string
  choice: number | { [k: string]: number }
  created: number
  space: {
    id: string
  }
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
    shouldFetch ? [endpoint, 'useVotingInfoOfProposals', proposalIds] : null,
    async (url) => getVotingInfoOfProposals(proposalIds)
  )
}

export interface VotesOfProposal {
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
    shouldFetch
      ? [endpoint, 'useVotesOfProposal', id, first, skip, orderBy]
      : null,
    async (url) => getVotesOfProposal(id, first, skip, orderBy)
  )
}

interface SnapshotVotingPower {
  vp: number
  vp_by_strategy: number[]
  vp_state: string
}

export async function getVotingPower(
  voter: string | undefined,
  space: string | undefined,
  proposal: string | undefined
): Promise<SnapshotVotingPower | undefined> {
  if (!voter || !space || !proposal) {
    return undefined
  }

  const variable = { voter, space, proposal }
  const data = await graphQLClient.request<{ vp: SnapshotVotingPower }>(
    votingPowerQuery,
    variable
  )

  return data?.vp
}

export function useVotingPower(
  voter: string | undefined,
  space: string | undefined,
  proposal: string | undefined,
  shouldFetch: boolean = true
) {
  return useSWR(
    shouldFetch ? [endpoint, 'useVotingPower', voter, space, proposal] : null,
    async (url) => getVotingPower(voter, space, proposal)
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

export async function getVotesOfAddress(
  address: string | undefined,
  first: number = 1000
): Promise<SnapshotGraphqlVoteByAddress[]> {
  if (!address) {
    return []
  }

  let allVotes: SnapshotGraphqlVoteByAddress[] = []
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const variable = { address, first, skip }
    const data = await graphQLClient.request<{
      votes: SnapshotGraphqlVoteByAddress[]
    }>(votesOfAddressQuery, variable)

    allVotes = [...allVotes, ...data.votes]

    // If we got fewer votes than requested, we've reached the end
    if (data.votes.length < first) {
      hasMore = false
    } else {
      skip += first
    }
  }

  return allVotes
}

export function useVotesOfAddress(
  address: string | undefined,
  first: number = 1000,
  shouldFetch: boolean = true
) {
  return useSWR(
    shouldFetch ? [endpoint, 'useVotesOfAddress', address, first] : null,
    async (url) => getVotesOfAddress(address, first)
  )
}
