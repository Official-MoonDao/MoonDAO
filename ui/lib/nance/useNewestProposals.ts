import { useProposals } from '@nance/nance-hooks'
import { ProposalsPacket } from '@nance/nance-sdk'
import {
  BooleanParam,
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from 'next-query-params'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import {
  SnapshotGraphqlProposalVotingInfo,
  useVotingInfoOfProposals,
} from '../snapshot'
import { NANCE_SPACE_NAME } from './constants'

export default function useNewestProposals(proposalLimit: number) {
  const router = useRouter()
  const [query] = useQueryParams({
    keyword: StringParam,
    limit: withDefault(NumberParam, proposalLimit),
    cycle: withDefault(StringParam, 'All'),
    sortBy: withDefault(StringParam, ''),
    sortDesc: withDefault(BooleanParam, false),
  })

  const { keyword, cycle, limit } = query

  const { data: proposalData, isLoading: proposalsLoading } = useProposals(
    { space: NANCE_SPACE_NAME, cycle, keyword, limit },
    router.isReady
  )

  const proposals = proposalData?.data.proposals

  const packet = useMemo(() => {
    return {
      proposalInfo: proposalData?.data.proposalInfo,
      proposals: proposals || [],
      hasMore: false,
    }
  }, [proposalData, proposals]) as ProposalsPacket

  const snapshotIds = proposals
    ?.map((p) => p.voteURL)
    .filter((v) => v !== undefined) as string[]
  const { data: votingInfos } = useVotingInfoOfProposals(snapshotIds)
  const votingInfoMap = useMemo(() => {
    const map: { [key: string]: SnapshotGraphqlProposalVotingInfo } = {}
    votingInfos?.forEach((info) => (map[info.id] = info))
    return map
  }, [votingInfos])

  return { proposals, packet, votingInfoMap, isLoading: proposalsLoading }
}
