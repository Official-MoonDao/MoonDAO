//PV = 1
import { useState } from 'react'

export default function useJBProjectTimeline(projectId: number, range: any) {
  const [points, setPoints] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  return { points, isLoading }
}
