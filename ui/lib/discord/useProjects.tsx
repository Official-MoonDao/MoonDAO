import { useEffect, useState } from 'react'

export function useProjects() {
  const [projects, setProjects] = useState<any>()

  async function getNewestProjects() {
    const response = await fetch('/api/discord/projects')

    const data = await response.json()
    setProjects(data)
  }

  useEffect(() => {
    getNewestProjects()
  }, [])

  return projects
}
