import useSWR from 'swr'
import { NANCE_API_URL, NANCE_SPACE_NAME } from './constants'

export type UserProposal = {
  uuid: string
  title: string
  proposalId?: number
  status: string
}

async function fetchUserProposals(
  url: string
): Promise<UserProposal[]> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) return []
  return (json.data?.proposals || []).map((p: any) => ({
    uuid: p.uuid,
    title: p.title,
    proposalId: p.proposalId,
    status: p.status,
  }))
}

export function useUserProposals(authorAddress: string | undefined) {
  const url =
    authorAddress
      ? `${NANCE_API_URL}/${NANCE_SPACE_NAME}/proposals?author=${authorAddress}`
      : null

  const { data, isLoading, error } = useSWR(url, fetchUserProposals, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  return {
    proposals: data,
    isLoading,
    error,
  }
}
