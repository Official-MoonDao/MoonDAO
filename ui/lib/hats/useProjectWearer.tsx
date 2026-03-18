import { useEffect, useState } from 'react'

/**
 * Uses team-centric API: iterates through projects and checks if the user's
 * address appears as a wearer in each project's hat tree. More reliable than
 * the previous get-wearer approach when subgraph mapping had issues.
 */
export function useProjectWearer(
  _projectContract: any,
  selectedChain: any,
  address: any
) {
  const [wornProjectHats, setWornProjectHats] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function fetchUserProjects() {
      try {
        setIsLoading(true)
        setWornProjectHats(undefined)
        if (!address) {
          setWornProjectHats([])
          setIsLoading(false)
          return
        }
        if (!selectedChain?.id) {
          setWornProjectHats([])
          setIsLoading(false)
          return
        }

        const res = await fetch(
          `/api/hats/user-memberships?chainId=${selectedChain.id}&wearerAddress=${encodeURIComponent(address)}`
        )
        const data = await res.json().catch(() => ({}))

        if (data?.projects && Array.isArray(data.projects)) {
          const formatted = data.projects.map((p: { projectId: string; name: string }) => ({
            projectId: p.projectId,
            name: p.name || `Project #${p.projectId}`,
            hats: [],
          }))
          setWornProjectHats(formatted)
        } else if (data?.projectIds && Array.isArray(data.projectIds)) {
          const formatted = data.projectIds.map((projectId: string) => ({
            projectId,
            name: null,
            hats: [],
          }))
          setWornProjectHats(formatted)
        } else {
          setWornProjectHats([])
        }
        setIsLoading(false)
      } catch (err) {
        console.warn('[useProjectWearer] Error:', err)
        setWornProjectHats([])
        setIsLoading(false)
      }
    }

    if (address && selectedChain) {
      fetchUserProjects()
    } else {
      setWornProjectHats(address ? undefined : [])
      setIsLoading(Boolean(address))
    }
  }, [address, selectedChain])

  return { userProjects: wornProjectHats, isLoading }
}
