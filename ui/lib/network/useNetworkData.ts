import CitizenABI from 'const/abis/Citizen.json'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import TeamABI from 'const/abis/Team.json'
import TeamTableABI from 'const/abis/TeamTable.json'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import {
  CITIZEN_TABLE_NAMES,
  TEAM_TABLE_NAMES,
  CITIZEN_TABLE_ADDRESSES,
  TEAM_TABLE_ADDRESSES,
  CITIZEN_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import { useEffect, useState, useMemo } from 'react'
import { useContext } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { citizenRowToNFT, teamRowToNFT } from '@/lib/tableland/convertRow'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { NetworkNFT, NetworkDataResult, UseNetworkDataOptions } from './types'
import {
  buildSearchClause,
  buildPaginationClause,
  calculateMaxPage,
  sortTeamsWithFeatured,
  filterBlockedTeams,
  filterBlockedCitizens,
} from './utils'

const PAGE_SIZE = 10

export function useTableNames() {
  const { selectedChain } = useContext(ChainContextV5)
  const chain = selectedChain || DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const [teamTableName, setTeamTableName] = useState<string | null>(
    TEAM_TABLE_NAMES[chainSlug] || null
  )
  const [citizenTableName, setCitizenTableName] = useState<string | null>(
    CITIZEN_TABLE_NAMES[chainSlug] || null
  )

  useEffect(() => {
    async function fetchTableNames() {
      try {
        if (!TEAM_TABLE_NAMES[chainSlug] && TEAM_TABLE_ADDRESSES[chainSlug]) {
          const teamTableContract = getContract({
            client,
            address: TEAM_TABLE_ADDRESSES[chainSlug],
            chain,
            abi: TeamTableABI as any,
          })
          const name = await readContract({
            contract: teamTableContract,
            method: 'getTableName',
          })
          setTeamTableName(name as string)
        }

        if (!CITIZEN_TABLE_NAMES[chainSlug] && CITIZEN_TABLE_ADDRESSES[chainSlug]) {
          const citizenTableContract = getContract({
            client,
            address: CITIZEN_TABLE_ADDRESSES[chainSlug],
            chain,
            abi: CitizenTableABI as any,
          })
          const name = await readContract({
            contract: citizenTableContract,
            method: 'getTableName',
          })
          setCitizenTableName(name as string)
        }
      } catch (error) {
        console.error('Error fetching table names:', error)
      }
    }

    fetchTableNames()
  }, [chain, chainSlug])

  return { teamTableName, citizenTableName }
}

export function useTeamsCount(
  search: string = '',
  enabled: boolean = true
): { count: number; isLoading: boolean } {
  const { teamTableName } = useTableNames()
  const searchClause = buildSearchClause(search)
  const statement = teamTableName
    ? `SELECT COUNT(*) as count FROM ${teamTableName} ${searchClause}`
    : null

  const { data, isLoading } = useTablelandQuery(enabled && statement ? statement : null, {
    revalidateOnFocus: false,
  })

  const count = data?.[0]?.count || 0
  return { count: Number(count), isLoading }
}

export function useCitizensCount(
  search: string = '',
  enabled: boolean = true
): { count: number; isLoading: boolean } {
  const { citizenTableName } = useTableNames()
  const searchClause = buildSearchClause(search)
  const statement = citizenTableName
    ? `SELECT COUNT(*) as count FROM ${citizenTableName} ${searchClause}`
    : null

  const { data, isLoading } = useTablelandQuery(enabled && statement ? statement : null, {
    revalidateOnFocus: false,
  })

  const count = data?.[0]?.count || 0
  return { count: Number(count), isLoading }
}

export function useTeams(options: UseNetworkDataOptions = {}): NetworkDataResult<NetworkNFT> {
  const { page = 1, pageSize = PAGE_SIZE, search = '', enabled = true, initialData } = options
  const { teamTableName } = useTableNames()
  const { count, isLoading: countLoading } = useTeamsCount(search, enabled)

  const searchClause = buildSearchClause(search)
  const paginationClause = buildPaginationClause(page, pageSize)
  const statement = teamTableName
    ? `SELECT * FROM ${teamTableName} ${searchClause} ORDER BY id DESC ${paginationClause}`
    : null

  // Use initial data for pages 1-3 if available and no search
  const fallbackData =
    !search && initialData && initialData.length > 0 && page >= 1 && page <= 3
      ? initialData.slice((page - 1) * pageSize, page * pageSize)
      : undefined

  const {
    data: rows,
    isLoading: rowsLoading,
    error,
  } = useTablelandQuery(enabled && statement ? statement : null, {
    revalidateOnFocus: false,
    fallbackData,
  })

  const teams = useMemo(() => {
    if (!rows || !Array.isArray(rows)) return []
    return rows
      .map((row) => {
        try {
          return teamRowToNFT(row) as NetworkNFT
        } catch (error) {
          console.error(`Error converting team row:`, error)
          return null
        }
      })
      .filter((team): team is NetworkNFT => team !== null)
  }, [rows])

  const filteredTeams = useMemo(() => filterBlockedTeams(teams), [teams])

  const sortedTeams = useMemo(() => sortTeamsWithFeatured(filteredTeams), [filteredTeams])

  const maxPage = calculateMaxPage(count, pageSize)

  return {
    data: sortedTeams,
    isLoading: countLoading || rowsLoading,
    error: error || null,
    totalCount: count,
    maxPage,
  }
}

export function useCitizens(options: UseNetworkDataOptions = {}): NetworkDataResult<NetworkNFT> {
  const { page = 1, pageSize = PAGE_SIZE, search = '', enabled = true, initialData } = options
  const { citizenTableName } = useTableNames()
  const { count, isLoading: countLoading } = useCitizensCount(search, enabled)

  const searchClause = buildSearchClause(search)
  const paginationClause = buildPaginationClause(page, pageSize)
  const statement = citizenTableName
    ? `SELECT * FROM ${citizenTableName} ${searchClause} ORDER BY id DESC ${paginationClause}`
    : null

  // Use initial data for pages 1-3 if available and no search
  const fallbackData =
    !search && initialData && initialData.length > 0 && page >= 1 && page <= 3
      ? initialData.slice((page - 1) * pageSize, page * pageSize)
      : undefined

  const {
    data: rows,
    isLoading: rowsLoading,
    error,
  } = useTablelandQuery(enabled && statement ? statement : null, {
    revalidateOnFocus: false,
    fallbackData,
  })

  const citizens = useMemo(() => {
    if (!rows || !Array.isArray(rows)) return []
    return rows
      .map((row) => {
        try {
          return citizenRowToNFT(row) as NetworkNFT
        } catch (error) {
          console.error(`Error converting citizen row:`, error)
          return null
        }
      })
      .filter((citizen): citizen is NetworkNFT => citizen !== null)
  }, [rows])

  const filteredCitizens = useMemo(() => filterBlockedCitizens(citizens), [citizens])

  const maxPage = calculateMaxPage(count, pageSize)

  return {
    data: filteredCitizens,
    isLoading: countLoading || rowsLoading,
    error: error || null,
    totalCount: count,
    maxPage,
  }
}

export function useValidTeams(options: UseNetworkDataOptions = {}): NetworkDataResult<NetworkNFT> {
  const { selectedChain } = useContext(ChainContextV5)
  const chain = selectedChain || DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const teamsResult = useTeams(options)
  // Show data optimistically while validation happens
  const [validTeams, setValidTeams] = useState<NetworkNFT[]>(teamsResult.data || [])
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<Error | null>(null)

  // Update optimistic data when teamsResult changes
  useEffect(() => {
    if (teamsResult.data) {
      setValidTeams(teamsResult.data)
    }
  }, [teamsResult.data])

  useEffect(() => {
    async function validateTeams() {
      if (!teamsResult.data || teamsResult.data.length === 0) {
        setValidTeams([])
        setIsValidating(false)
        return
      }

      setIsValidating(true)
      setValidationError(null)

      try {
        const teamContract = getContract({
          client,
          address: TEAM_ADDRESSES[chainSlug],
          chain,
          abi: TeamABI as any,
        })

        const now = Math.floor(Date.now() / 1000)

        // Use Promise.allSettled to handle individual failures gracefully
        const validationResults = await Promise.allSettled(
          teamsResult.data.map(async (team) => {
            try {
              const expiresAt = await readContract({
                contract: teamContract,
                method: 'expiresAt',
                params: [team.metadata.id],
              })
              return +expiresAt.toString() > now ? team : null
            } catch (error) {
              // If validation fails, assume valid (optimistic) rather than filtering out
              console.warn(
                `Error checking expiration for team ${team.metadata.id}, showing optimistically:`,
                error
              )
              return team // Return team optimistically on error
            }
          })
        )

        const valid = validationResults
          .map((result) => (result.status === 'fulfilled' ? result.value : null))
          .filter((team): team is NetworkNFT => team !== null)

        // Only update if we got valid results, otherwise keep optimistic data
        if (valid.length > 0 || validationResults.every((r) => r.status === 'rejected')) {
          setValidTeams(valid)
        }
      } catch (error) {
        console.error('Error validating teams:', error)
        setValidationError(error as Error)
        // Don't clear data on error - keep showing optimistic data
      } finally {
        setIsValidating(false)
      }
    }

    validateTeams()
  }, [teamsResult.data, chain, chainSlug])

  return {
    data: validTeams,
    isLoading: teamsResult.isLoading,
    error: validationError || teamsResult.error,
    totalCount: teamsResult.totalCount,
    maxPage: teamsResult.maxPage,
  }
}

export function useValidCitizens(
  options: UseNetworkDataOptions = {}
): NetworkDataResult<NetworkNFT> {
  const { selectedChain } = useContext(ChainContextV5)
  const chain = selectedChain || DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const citizensResult = useCitizens(options)
  // Show data optimistically while validation happens
  const [validCitizens, setValidCitizens] = useState<NetworkNFT[]>(citizensResult.data || [])
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<Error | null>(null)

  // Update optimistic data when citizensResult changes
  useEffect(() => {
    if (citizensResult.data) {
      setValidCitizens(citizensResult.data)
    }
  }, [citizensResult.data])

  useEffect(() => {
    async function validateCitizens() {
      if (!citizensResult.data || citizensResult.data.length === 0) {
        setValidCitizens([])
        setIsValidating(false)
        return
      }

      setIsValidating(true)
      setValidationError(null)

      try {
        const citizenContract = getContract({
          client,
          address: CITIZEN_ADDRESSES[chainSlug],
          chain,
          abi: CitizenABI as any,
        })

        const now = Math.floor(Date.now() / 1000)

        // Use Promise.allSettled to handle individual failures gracefully
        const validationResults = await Promise.allSettled(
          citizensResult.data.map(async (citizen) => {
            try {
              const expiresAt = await readContract({
                contract: citizenContract,
                method: 'expiresAt',
                params: [citizen.metadata.id],
              })
              return +expiresAt.toString() > now ? citizen : null
            } catch (error) {
              // If validation fails, assume valid (optimistic) rather than filtering out
              console.warn(
                `Error checking expiration for citizen ${citizen.metadata.id}, showing optimistically:`,
                error
              )
              return citizen // Return citizen optimistically on error
            }
          })
        )

        const valid = validationResults
          .map((result) => (result.status === 'fulfilled' ? result.value : null))
          .filter((citizen): citizen is NetworkNFT => citizen !== null)

        // Only update if we got valid results, otherwise keep optimistic data
        if (valid.length > 0 || validationResults.every((r) => r.status === 'rejected')) {
          setValidCitizens(valid)
        }
      } catch (error) {
        console.error('Error validating citizens:', error)
        setValidationError(error as Error)
        // Don't clear data on error - keep showing optimistic data
      } finally {
        setIsValidating(false)
      }
    }

    validateCitizens()
  }, [citizensResult.data, chain, chainSlug])

  return {
    data: validCitizens,
    isLoading: citizensResult.isLoading,
    error: validationError || citizensResult.error,
    totalCount: citizensResult.totalCount,
    maxPage: citizensResult.maxPage,
  }
}
