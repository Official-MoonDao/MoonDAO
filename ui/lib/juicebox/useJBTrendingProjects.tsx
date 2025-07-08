import { useEffect, useState } from 'react'
import { trendingProjectsQuery } from './subgraph'

export default function useJBTrendingProjects() {
  const [trendingProjects, setTrendingProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function getTrendingProjects() {
      setIsLoading(true)
      const query = trendingProjectsQuery(10)
      const res = await fetch(`/api/juicebox/query?query=${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json()
      setTrendingProjects(data.projects?.items || [])
      setIsLoading(false)
    }
    getTrendingProjects()
  }, [])

  return { trendingProjects, isLoading }
}
