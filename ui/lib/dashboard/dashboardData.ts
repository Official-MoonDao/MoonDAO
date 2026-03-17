import { BLOCKED_CITIZENS, BLOCKED_PROJECTS } from 'const/whitelist'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'

const DASHBOARD_PRIORITY_PROJECT_IDS = new Set([85])
const DASHBOARD_PRIORITY_PROJECT_NAMES = new Set(['citizens space policy initiative'])

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function getCitizenLocation(citizen: any): string | null {
  const location =
    citizen?.location ??
    citizen?.metadata?.attributes?.find((attribute: any) => attribute.trait_type === 'location')
      ?.value

  if (!location || typeof location !== 'string') return null

  const trimmed = location.trim()
  if (!trimmed || trimmed.startsWith('[object')) return null

  try {
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed)
      return parsed?.name || null
    }

    return trimmed
  } catch {
    return trimmed
  }
}

function getNormalizedSocialHandle(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const socialMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i
  )

  if (socialMatch?.[1]) {
    return `@${socialMatch[1]}`
  }

  return trimmed
}

function isDashboardPriorityProject(project: any) {
  const projectId = Number(project?.id)
  const projectName = typeof project?.name === 'string' ? project.name.trim().toLowerCase() : ''

  return (
    DASHBOARD_PRIORITY_PROJECT_IDS.has(projectId) ||
    DASHBOARD_PRIORITY_PROJECT_NAMES.has(projectName)
  )
}

export function filterDashboardCitizens(citizens: any[] = []) {
  return citizens.filter((citizen) => {
    if (!citizen) return false

    const citizenId = Number(citizen.id ?? citizen?.metadata?.id)
    const citizenName = String(citizen.name ?? citizen?.metadata?.name ?? '')
      .trim()
      .toLowerCase()

    if (BLOCKED_CITIZENS.has(citizenId)) return false
    if (citizenName === 'test') return false

    return true
  })
}

export function getDashboardCitizenMetadata(citizen: any): string | null {
  const location = getCitizenLocation(citizen)
  if (location) return location

  const twitter =
    citizen?.twitter ??
    citizen?.metadata?.attributes?.find((attribute: any) => attribute.trait_type === 'twitter')
      ?.value
  const normalizedTwitter = getNormalizedSocialHandle(twitter)
  if (normalizedTwitter) return truncateText(normalizedTwitter, 25)

  const discord =
    citizen?.discord ??
    citizen?.metadata?.attributes?.find((attribute: any) => attribute.trait_type === 'discord')
      ?.value
  if (discord) return truncateText(discord, 25)

  return null
}

export function buildDashboardProjectLists(projects: any[] = []) {
  const proposals: any[] = []
  const currentProjects: any[] = []
  const seenProjectIds = new Set<number>()

  for (const project of projects) {
    if (!project || BLOCKED_PROJECTS.has(Number(project.id))) continue

    const activeStatus = Number(project.active)
    const projectId = Number(project.id)
    const shouldIncludeAsActive =
      activeStatus === PROJECT_ACTIVE || isDashboardPriorityProject(project)

    if (activeStatus === PROJECT_PENDING) {
      proposals.push(project)
      continue
    }

    if (!shouldIncludeAsActive || seenProjectIds.has(projectId)) {
      continue
    }

    currentProjects.push({
      ...project,
      active: PROJECT_ACTIVE,
    })
    seenProjectIds.add(projectId)
  }

  currentProjects.sort((a, b) => {
    if (a.eligible === b.eligible) {
      return 0
    }

    return a.eligible ? 1 : -1
  })

  return {
    proposals,
    currentProjects,
  }
}

export function countDashboardCitizens(locations: any[] = []) {
  if (!Array.isArray(locations) || locations.length === 0) return 0

  return locations.reduce((count, location) => {
    if (Array.isArray(location?.citizens)) {
      return count + location.citizens.length
    }

    return count
  }, 0)
}

export function countUniqueCountries(locations: any[]) {
  if (!locations || locations.length === 0) return 25

  try {
    const countries = new Set(
      locations
        .map((location) => location.country || location.formattedAddress?.split(',').pop()?.trim() || 'Unknown')
        .filter((country) => country && country !== 'Unknown' && country !== '')
    )

    return countries.size > 0 ? countries.size : 25
  } catch (error) {
    console.error('Error counting countries:', error)
    return 25
  }
}

export function getDashboardMissionSupportStat(
  subgraphData: any,
  backers: any[] | undefined
) {
  if (subgraphData?.paymentsCount !== undefined) {
    return {
      label: 'Contributions',
      value: Number(subgraphData.paymentsCount) || 0,
    }
  }

  return {
    label: 'Backers',
    value: backers?.length || 0,
  }
}

