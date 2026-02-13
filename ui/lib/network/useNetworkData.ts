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
import { useEffect, useState, useMemo, useRef } from 'react'
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
  const { page = 1, pageSize = PAGE_SIZE } = options
  const { selectedChain } = useContext(ChainContextV5)
  const chain = selectedChain || DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  // Fetch all teams without SQL pagination — we paginate after validation
  // to ensure consistent page sizes (expired teams are filtered client-side)
  const teamsResult = useTeams({ ...options, page: 1, pageSize: 9999 })
  // Show data optimistically while validation happens
  const [validTeams, setValidTeams] = useState<NetworkNFT[]>(teamsResult.data || [])
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<Error | null>(null)
  const lastValidatedDataKeyRef = useRef<string>('')

  // Create a stable reference key
  const dataKey = useMemo(() => {
    if (!teamsResult.data || teamsResult.data.length === 0) return ''
    return teamsResult.data.map((t) => t.metadata.id).join(',')
  }, [teamsResult.data])

  useEffect(() => {
    if (dataKey !== lastValidatedDataKeyRef.current) {
      if (teamsResult.data) {
        setValidTeams(teamsResult.data)
      }
    }
  }, [dataKey, teamsResult.data])

  useEffect(() => {
    async function validateTeams() {
      if (!teamsResult.data || teamsResult.data.length === 0) {
        setValidTeams([])
        setIsValidating(false)
        lastValidatedDataKeyRef.current = ''
        return
      }

      // Skip validation if data hasn't changed
      const currentDataKey = teamsResult.data.map((t) => t.metadata.id).join(',')
      if (currentDataKey === lastValidatedDataKeyRef.current) {
        return
      }

      lastValidatedDataKeyRef.current = currentDataKey
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
        const teamIds = teamsResult.data.map((t) => t.metadata.id)

        // Use batched validation with controlled concurrency
        const BATCH_SIZE = 25 // Smaller batches for client-side
        const batches = []
        for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
          batches.push(teamIds.slice(i, i + BATCH_SIZE))
        }

        const validTeamsMap = new Map<string | number, NetworkNFT>()

        // Process batches with controlled concurrency
        for (const batch of batches) {
          const validationResults = await Promise.allSettled(
            batch.map(async (id) => {
              try {
                const expiresAt = await readContract({
                  contract: teamContract,
                  method: 'expiresAt',
                  params: [id],
                })
                return {
                  id,
                  isValid: Number(expiresAt.toString()) > now,
                }
              } catch (error) {
                console.warn(
                  `Error checking expiration for team ${id}, showing optimistically:`,
                  error
                )
                return { id, isValid: true } // Optimistic on error
              }
            })
          )

          for (const result of validationResults) {
            if (result.status === 'fulfilled' && result.value.isValid) {
              const team = teamsResult.data.find((t) => t.metadata.id === result.value.id)
              if (team) {
                validTeamsMap.set(result.value.id, team)
              }
            }
          }
        }

        const valid = teamsResult.data.filter((team) => validTeamsMap.has(team.metadata.id))

        // Only update if we got valid results, otherwise keep optimistic data
        if (valid.length > 0) {
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
  }, [dataKey, chain, chainSlug, teamsResult.data])

  // Paginate after validation to ensure consistent page sizes
  const paginatedTeams = useMemo(() => {
    const start = (page - 1) * pageSize
    return validTeams.slice(start, start + pageSize)
  }, [validTeams, page, pageSize])

  const validMaxPage = useMemo(
    () => calculateMaxPage(validTeams.length, pageSize),
    [validTeams.length, pageSize]
  )

  return {
    data: paginatedTeams,
    isLoading: teamsResult.isLoading,
    error: validationError || teamsResult.error,
    totalCount: validTeams.length,
    maxPage: validMaxPage,
  }
}

export function useValidCitizens(
  options: UseNetworkDataOptions = {}
): NetworkDataResult<NetworkNFT> {
  const { page = 1, pageSize = PAGE_SIZE } = options
  const { selectedChain } = useContext(ChainContextV5)
  const chain = selectedChain || DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  // Fetch all citizens without SQL pagination — we paginate after validation
  // to ensure consistent page sizes (expired citizens are filtered client-side)
  const citizensResult = useCitizens({ ...options, page: 1, pageSize: 9999 })
  // Show data optimistically while validation happens
  const [validCitizens, setValidCitizens] = useState<NetworkNFT[]>(citizensResult.data || [])
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<Error | null>(null)
  const lastValidatedDataKeyRef = useRef<string>('')

  const dataKey = useMemo(() => {
    if (!citizensResult.data || citizensResult.data.length === 0) return ''
    return citizensResult.data.map((c) => c.metadata.id).join(',')
  }, [citizensResult.data])

  // Update optimistic data when citizensResult changes
  useEffect(() => {
    if (dataKey !== lastValidatedDataKeyRef.current) {
      if (citizensResult.data) {
        setValidCitizens(citizensResult.data)
      }
    }
  }, [dataKey, citizensResult.data])

  useEffect(() => {
    async function validateCitizens() {
      if (!citizensResult.data || citizensResult.data.length === 0) {
        setValidCitizens([])
        setIsValidating(false)
        lastValidatedDataKeyRef.current = ''
        return
      }

      // Skip validation if data hasn't changed
      const currentDataKey = citizensResult.data.map((c) => c.metadata.id).join(',')
      if (currentDataKey === lastValidatedDataKeyRef.current) {
        return
      }

      lastValidatedDataKeyRef.current = currentDataKey
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
        const citizenIds = citizensResult.data.map((c) => c.metadata.id)

        // Use batched validation with controlled concurrency
        const BATCH_SIZE = 25 // Smaller batches for client-side
        const batches = []
        for (let i = 0; i < citizenIds.length; i += BATCH_SIZE) {
          batches.push(citizenIds.slice(i, i + BATCH_SIZE))
        }

        const validCitizensMap = new Map<string | number, NetworkNFT>()

        // Process batches with controlled concurrency
        for (const batch of batches) {
          const validationResults = await Promise.allSettled(
            batch.map(async (id) => {
              try {
                const expiresAt = await readContract({
                  contract: citizenContract,
                  method: 'expiresAt',
                  params: [id],
                })
                return {
                  id,
                  isValid: Number(expiresAt.toString()) > now,
                }
              } catch (error) {
                console.warn(
                  `Error checking expiration for citizen ${id}, showing optimistically:`,
                  error
                )
                return { id, isValid: true } // Optimistic on error
              }
            })
          )

          for (const result of validationResults) {
            if (result.status === 'fulfilled' && result.value.isValid) {
              const citizen = citizensResult.data.find((c) => c.metadata.id === result.value.id)
              if (citizen) {
                validCitizensMap.set(result.value.id, citizen)
              }
            }
          }
        }

        const valid = citizensResult.data.filter((citizen) =>
          validCitizensMap.has(citizen.metadata.id)
        )

        // Only update if we got valid results, otherwise keep optimistic data
        if (valid.length > 0) {
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
  }, [dataKey, chain, chainSlug, citizensResult.data])

  // Paginate after validation to ensure consistent page sizes
  const paginatedCitizens = useMemo(() => {
    const start = (page - 1) * pageSize
    return validCitizens.slice(start, start + pageSize)
  }, [validCitizens, page, pageSize])

  const validMaxPage = useMemo(
    () => calculateMaxPage(validCitizens.length, pageSize),
    [validCitizens.length, pageSize]
  )

  return {
    data: paginatedCitizens,
    isLoading: citizensResult.isLoading,
    error: validationError || citizensResult.error,
    totalCount: validCitizens.length,
    maxPage: validMaxPage,
  }
}
