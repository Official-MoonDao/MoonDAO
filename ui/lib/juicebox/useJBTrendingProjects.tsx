import { useEffect, useState } from 'react'
import { trendingProjectsQuery } from './subgraph'

export default function useJBTrendingProjects() {
  const [trendingProjects, setTrendingProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function fetchTrendingProjects() {
      setIsLoading(true)
      const query = trendingProjectsQuery(10)
      const res = await fetch(`/api/juicebox/query?query=${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json()
      console.log('TRENDING', data)
      setTrendingProjects(data.data)
      setIsLoading(false)
    }
    fetchTrendingProjects()
  }, [])

  return { trendingProjects, isLoading }
}
