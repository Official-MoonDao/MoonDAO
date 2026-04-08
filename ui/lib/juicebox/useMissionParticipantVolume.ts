import useSWR from 'swr'
import { missionParticipantVolumeQuery } from '@/lib/juicebox/subgraph'

async function fetchParticipantVolume([_, projectId, address]: [
  string,
  number,
  string
]): Promise<bigint> {
  const query = missionParticipantVolumeQuery(projectId, address)
  if (!query) return BigInt(0)
  const res = await fetch('/api/juicebox/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) {
    return BigInt(0)
  }
  const items = data?.payEvents?.items || []
  return items.reduce(
    (acc: bigint, e: any) => acc + BigInt(e.amount || '0'),
    BigInt(0)
  )
}

export function useMissionParticipantVolume(
  projectId: number | undefined,
  address: string | undefined
) {
  const key =
    projectId != null &&
    projectId > 0 &&
    address &&
    /^0x[a-fA-F0-9]{40}$/.test(address)
      ? (['missionParticipantVolume', projectId, address] as const)
      : null

  const { data, error, isLoading, mutate } = useSWR(key, fetchParticipantVolume, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  })

  return {
    volumeWei: data ?? null,
    isLoading: Boolean(key) && isLoading,
    error,
    mutate,
  }
}
