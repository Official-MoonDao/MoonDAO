import { useEffect, useState } from 'react'

/**
 * Team-centric approach: fetch teams where the user wears a hat in the team's
 * hat tree. Uses /api/hats/user-memberships which iterates teams and checks
 * wearers directly (more reliable than get-wearer + adminHatToTokenId mapping).
 */
export function useTeamWearer(
  _teamContract: any,
  selectedChain: any,
  address: string | undefined
) {
  const [userTeams, setUserTeams] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function fetchUserTeams() {
      try {
        setIsLoading(true)
        setUserTeams(undefined)
        if (!address) {
          setUserTeams([])
          setIsLoading(false)
          return
        }
        if (!selectedChain?.id) {
          setUserTeams([])
          setIsLoading(false)
          return
        }

        const res = await fetch(
          `/api/hats/user-memberships?chainId=${selectedChain.id}&wearerAddress=${encodeURIComponent(address)}`
        )
        const data = await res.json()

        if (data?.teams && Array.isArray(data.teams)) {
          setUserTeams(
            data.teams.map((t: { teamId: string; name: string }) => ({
              teamId: t.teamId,
              name: t.name || `Team #${t.teamId}`,
              hats: [],
            }))
          )
        } else if (data?.teamIds && Array.isArray(data.teamIds)) {
          setUserTeams(
            data.teamIds.map((teamId: string) => ({
              teamId,
              name: null,
              hats: [],
            }))
          )
        } else {
          setUserTeams([])
        }
      } catch (err) {
        console.warn('[useTeamWearer] Error:', err)
        setUserTeams([])
      } finally {
        setIsLoading(false)
      }
    }

    if (address && selectedChain) {
      fetchUserTeams()
    } else {
      setUserTeams(address ? undefined : [])
      setIsLoading(Boolean(address))
    }
  }, [address, selectedChain])

  return { userTeams, isLoading }
}
