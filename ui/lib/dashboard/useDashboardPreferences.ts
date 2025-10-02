import { useState, useEffect } from 'react'

export interface DashboardPreferences {
  showQuests: boolean
  showProjects: boolean
  showJobs: boolean
  showLaunchpad: boolean
  showEvents: boolean
  showGlobalMap: boolean
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  showQuests: true,
  showProjects: true,
  showJobs: true,
  showLaunchpad: true,
  showEvents: true,
  showGlobalMap: true,
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load preferences from localStorage
    const stored = localStorage.getItem('dashboardPreferences')
    if (stored) {
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) })
      } catch (error) {
        console.error('Failed to parse dashboard preferences:', error)
      }
    }
    setIsLoading(false)
  }, [])

  const updatePreferences = (newPreferences: Partial<DashboardPreferences>) => {
    const updated = { ...preferences, ...newPreferences }
    setPreferences(updated)
    localStorage.setItem('dashboardPreferences', JSON.stringify(updated))
  }

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
    localStorage.setItem('dashboardPreferences', JSON.stringify(DEFAULT_PREFERENCES))
  }

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    isLoading,
  }
}
