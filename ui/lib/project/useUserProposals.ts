import useSWR from 'swr'

export type UserProposal = {
  uuid: string
  title: string
  proposalId?: number
  status: string
  MDP: number
}

async function fetchUserProposals(url: string): Promise<UserProposal[]> {
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export function useUserProposals(authorAddress: string | undefined) {
  const url = authorAddress
    ? `/api/tableland/user-proposals?address=${authorAddress}`
    : null

  const { data, isLoading, error } = useSWR(url, fetchUserProposals, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  })

  return {
    proposals: data,
    isLoading,
    error,
  }
}
