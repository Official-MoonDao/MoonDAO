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
import { NANCE_SPACE_NAME } from './constants'

export default function useOpenVoteProposals() {
  const router = useRouter()
  const [query] = useQueryParams({
    keyword: StringParam,
    limit: withDefault(NumberParam, 100),
    cycle: withDefault(StringParam, 'All'),
    sortBy: withDefault(StringParam, ''),
    sortDesc: withDefault(BooleanParam, false),
  })

  const { keyword, cycle, limit } = query

  const { data: proposalData, isLoading: proposalsLoading } = useProposals(
    { space: NANCE_SPACE_NAME, cycle, keyword, limit },
    router.isReady
  )

  const proposals = useMemo(() => {
    const proposals = proposalData?.data.proposals
    return proposals?.filter((p) => p.status === 'Voting')
  }, [proposalData])

  const packet = useMemo(() => {
    return {
      proposalInfo: proposalData?.data.proposalInfo,
      proposals: proposals || [],
      hasMore: false,
    }
  }, [proposalData, proposals]) as ProposalsPacket

  return { proposals, packet }
}
