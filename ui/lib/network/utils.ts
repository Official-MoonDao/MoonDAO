import { FEATURED_TEAMS, BLOCKED_TEAMS, BLOCKED_CITIZENS } from 'const/whitelist'
import { NetworkNFT } from './types'

export function sortTeamsWithFeatured(teams: NetworkNFT[]): NetworkNFT[] {
  return [...teams].sort((a: NetworkNFT, b: NetworkNFT) => {
    const aId = Number(a.metadata.id)
    const bId = Number(b.metadata.id)
    const aIsFeatured = FEATURED_TEAMS.includes(aId)
    const bIsFeatured = FEATURED_TEAMS.includes(bId)

    if (aIsFeatured && bIsFeatured) {
      return (
        FEATURED_TEAMS.indexOf(aId) - FEATURED_TEAMS.indexOf(bId)
      )
    } else if (aIsFeatured) {
      return -1
    } else if (bIsFeatured) {
      return 1
    } else {
      return 0
    }
  })
}

export function filterBlockedTeams(teams: NetworkNFT[]): NetworkNFT[] {
  return teams.filter((team) => {
    const teamId = Number(team.metadata.id)
    return !BLOCKED_TEAMS.has(teamId)
  })
}

export function filterBlockedCitizens(citizens: NetworkNFT[]): NetworkNFT[] {
  return citizens.filter((citizen) => {
    const citizenId = Number(citizen.metadata.id)
    return !BLOCKED_CITIZENS.has(citizenId)
  })
}

export function buildSearchClause(search: string, column: string = 'name'): string {
  if (!search || search.trim() === '') {
    return ''
  }
  const sanitized = search.trim().replace(/'/g, "''")
  return `WHERE ${column} LIKE '%${sanitized}%'`
}

export function buildSearchClauseForCount(search: string, column: string = 'name'): string {
  return buildSearchClause(search, column)
}

export function buildPaginationClause(page: number, pageSize: number): string {
  const offset = (page - 1) * pageSize
  return `LIMIT ${pageSize} OFFSET ${offset}`
}

export function calculateMaxPage(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize))
}

