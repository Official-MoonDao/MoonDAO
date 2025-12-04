import { useEffect, useState, useMemo } from 'react'
import { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import {
  CITIZEN_TABLE_NAMES,
  CITIZEN_TABLE_ADDRESSES,
  CITIZEN_ADDRESSES,
} from 'const/config'
import { getContract, readContract } from 'thirdweb'
import client from '@/lib/thirdweb/client'
import CitizenTableABI from 'const/abis/CitizenTable.json'
import CitizenABI from 'const/abis/Citizen.json'
import { citizenRowToNFT } from '@/lib/tableland/convertRow'
import { getAttribute } from '@/lib/utils/nft'
import { filterBlockedCitizens } from './utils'
import { NetworkNFT, GroupedLocationData } from './types'

export function useMapData(enabled: boolean = true) {
  const { selectedChain } = useContext(ChainContextV5)
  const chain = selectedChain || DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const [citizenTableName, setCitizenTableName] = useState<string | null>(
    CITIZEN_TABLE_NAMES[chainSlug] || null
  )

  useEffect(() => {
    async function fetchTableName() {
      if (!CITIZEN_TABLE_NAMES[chainSlug] && CITIZEN_TABLE_ADDRESSES[chainSlug]) {
        try {
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
        } catch (error) {
          console.error('Error fetching citizen table name:', error)
        }
      }
    }
    fetchTableName()
  }, [chain, chainSlug])

  const statement = citizenTableName && enabled
    ? `SELECT * FROM ${citizenTableName}`
    : null

  const { data: citizenRows, isLoading, error } = useTablelandQuery(
    statement,
    { revalidateOnFocus: false }
  )

  const [validCitizens, setValidCitizens] = useState<NetworkNFT[]>([])
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    async function validateAndProcessCitizens() {
      if (!citizenRows || !Array.isArray(citizenRows) || citizenRows.length === 0) {
        setValidCitizens([])
        setIsValidating(false)
        return
      }

      setIsValidating(true)

      try {
        const citizens: NetworkNFT[] = citizenRows
          .map((row) => {
            try {
              return citizenRowToNFT(row) as NetworkNFT
            } catch (error) {
              console.error(`Error converting citizen row:`, error)
              return null
            }
          })
          .filter((citizen): citizen is NetworkNFT => citizen !== null)

        const filtered = filterBlockedCitizens(citizens)

        const citizenContract = getContract({
          client,
          address: CITIZEN_ADDRESSES[chainSlug],
          chain,
          abi: CitizenABI as any,
        })

        const now = Math.floor(Date.now() / 1000)

        const validationResults = await Promise.all(
          filtered.map(async (citizen) => {
            try {
              const expiresAt = await readContract({
                contract: citizenContract,
                method: 'expiresAt',
                params: [citizen.metadata.id],
              })
              return +expiresAt.toString() > now ? citizen : null
            } catch (error) {
              console.error(
                `Error checking expiration for citizen ${citizen.metadata.id}:`,
                error
              )
              return null
            }
          })
        )

        const valid = validationResults.filter(
          (citizen): citizen is NetworkNFT => citizen !== null
        )
        setValidCitizens(valid)
      } catch (error) {
        console.error('Error validating citizens for map:', error)
        setValidCitizens([])
      } finally {
        setIsValidating(false)
      }
    }

    if (citizenRows) {
      validateAndProcessCitizens()
    }
  }, [citizenRows, chain, chainSlug])

  const locationData = useMemo(() => {
    if (
      !validCitizens ||
      validCitizens.length === 0 ||
      (process.env.NEXT_PUBLIC_ENV !== 'prod' &&
        process.env.NEXT_PUBLIC_TEST_ENV !== 'true')
    ) {
      return []
    }

    const citizensLocationData: any[] = []

    for (const citizen of validCitizens) {
      const citizenLocation = getAttribute(
        citizen?.metadata?.attributes as unknown as any[],
        'location'
      )?.value

      let locationData

      if (
        citizenLocation &&
        citizenLocation !== '' &&
        !citizenLocation?.startsWith('{')
      ) {
        locationData = {
          results: [
            {
              formatted_address: citizenLocation,
            },
          ],
        }
      } else if (citizenLocation?.startsWith('{')) {
        const parsedLocationData = JSON.parse(citizenLocation)
        locationData = {
          results: [
            {
              formatted_address: parsedLocationData.name,
              geometry: {
                location: {
                  lat: parsedLocationData.lat,
                  lng: parsedLocationData.lng,
                },
              },
            },
          ],
        }
      } else {
        locationData = {
          results: [
            {
              formatted_address: 'Antarctica',
              geometry: { location: { lat: -90, lng: 0 } },
            },
          ],
        }
      }

      citizensLocationData.push({
        id: citizen.metadata.id,
        name: citizen.metadata.name,
        location: citizenLocation,
        formattedAddress:
          locationData.results?.[0]?.formatted_address || 'Antarctica',
        image: citizen.metadata.image,
        lat: locationData.results?.[0]?.geometry?.location?.lat || -90,
        lng: locationData.results?.[0]?.geometry?.location?.lng || 0,
      })
    }

    const locationMap = new Map()

    for (const citizen of citizensLocationData) {
      const key = `${citizen.lat},${citizen.lng}`
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          citizens: [citizen],
          names: [citizen.name],
          formattedAddress: citizen.formattedAddress,
          lat: citizen.lat,
          lng: citizen.lng,
        })
      } else {
        const existing = locationMap.get(key)
        existing.names.push(citizen.name)
        existing.citizens.push(citizen)
      }
    }

    return Array.from(locationMap.values()).map(
      (entry: any): GroupedLocationData => ({
        ...entry,
        color:
          entry.citizens.length > 3
            ? '#6a3d79'
            : entry.citizens.length > 1
            ? '#5e4dbf'
            : '#5556eb',
        size:
          entry.citizens.length > 1
            ? Math.min(entry.citizens.length * 0.01, 0.4)
            : 0.01,
      })
    )
  }, [validCitizens])

  return {
    data: locationData,
    isLoading: isLoading || isValidating,
    error: error || null,
  }
}

