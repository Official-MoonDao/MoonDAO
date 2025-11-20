import { BLOCKED_MISSIONS } from 'const/whitelist'
import { useEffect, useMemo, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { Job } from '@/components/jobs/Job'
import { Mission } from '@/components/mission/MissionCard'
import { TeamListing } from '@/components/subscription/TeamListing'
import { getAttribute } from '../utils/nft'
import { addHttpsIfMissing } from '../utils/strings'

export function useTeamData(
  teamContract: any,
  hatsContract: any,
  nft: any,
  isCitizen?: boolean,
  fetchActivityData?: {
    teamId: string | number
    selectedChain: any
    jobTableContract: any
    marketplaceTableContract: any
    missionTableContract: any
    jbControllerContract: any
  }
) {
  const account = useActiveAccount()
  const address = account?.address

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPublic, setIsPublic] = useState<boolean>(false)
  const [isDeleted, setIsDeleted] = useState<boolean>(false)
  const [isManager, setIsManager] = useState<boolean>(false)
  const [subIsValid, setSubIsValid] = useState<boolean>(true)
  const [hatTreeId, setHatTreeId] = useState<any>()
  const [adminHatId, setAdminHatId] = useState<any>()
  const [managerHatId, setManagerHatId] = useState<any>()

  // Activity data state (optional)
  const [jobs, setJobs] = useState<Job[]>([])
  const [listings, setListings] = useState<TeamListing[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [isLoadingActivityData, setIsLoadingActivityData] = useState(false)
  const [activityError, setActivityError] = useState<Error | null>(null)

  // Determine access level for the current user
  const hasFullAccess = useMemo(() => {
    return isManager || address === nft?.owner
  }, [isManager, address, nft?.owner])

  const socials = useMemo(() => {
    const entityTwitter = getAttribute(
      nft?.metadata?.attributes,
      'twitter'
    )?.value
    const entityCommunications = getAttribute(
      nft?.metadata?.attributes,
      'communications'
    )?.value
    const entityWebsite = getAttribute(
      nft?.metadata?.attributes,
      'website'
    )?.value

    const formattedTwitter =
      !entityTwitter || entityTwitter === ''
        ? ''
        : entityTwitter?.startsWith('https://x.com/') ||
          entityTwitter?.startsWith('https://twitter.com/')
        ? entityTwitter
        : `https://x.com/${entityTwitter?.replace('https://', '')}`
    return {
      twitter: formattedTwitter,
      communications: entityCommunications
        ? addHttpsIfMissing(entityCommunications)
        : '',
      website: entityWebsite ? addHttpsIfMissing(entityWebsite) : '',
    }
  }, [nft?.metadata?.attributes])

  useEffect(() => {
    function getView() {
      const entityView: any = getAttribute(nft?.metadata?.attributes, 'view')
      setIsPublic(entityView?.value === 'public' ? true : false)
      setIsDeleted(entityView?.value === '' ? true : false)
    }

    async function checkSubscription() {
      const now = Math.floor(Date.now() / 1000)

      try {
        const expiresAt = await readContract({
          contract: teamContract,
          method: 'expiresAt' as string,
          params: [nft?.metadata?.id],
        })
        setSubIsValid(+expiresAt.toString() > now)
      } catch (err) {
        console.log(err)
      }
    }

    async function getHats() {
      const results = await Promise.allSettled([
        readContract({
          contract: teamContract,
          method: 'teamAdminHat' as string,
          params: [nft?.metadata?.id || ''],
        }),
        readContract({
          contract: teamContract,
          method: 'teamManagerHat' as string,
          params: [nft?.metadata?.id || ''],
        }),
      ])

      const adminHID =
        results[0].status === 'fulfilled' ? results[0].value : null
      const managerHID =
        results[1].status === 'fulfilled' ? results[1].value : null

      setAdminHatId(adminHID)
      setManagerHatId(managerHID)
    }

    if (nft?.metadata?.attributes && teamContract) {
      ;(async () => {
        setIsLoading(true)
        await checkSubscription()
        await getHats()
        getView()
        setIsLoading(false)
      })()
    }
  }, [nft, teamContract])

  useEffect(() => {
    async function checkManager() {
      try {
        if (address) {
          const isAddressManager: any = await readContract({
            contract: teamContract,
            method: 'isManager' as string,
            params: [nft?.metadata?.id, address],
          })
          setIsManager(isAddressManager || nft.owner === address)
        } else {
          setIsManager(false)
        }
      } catch (err) {
        console.log(err)
        setIsManager(false)
      }
    }

    if (teamContract) checkManager()
  }, [account, address, nft, teamContract])

  useEffect(() => {
    async function getHatTreeId() {
      const hatTreeId = await readContract({
        contract: hatsContract,
        method: 'getTopHatDomain' as string,
        params: [adminHatId],
      })
      setHatTreeId(hatTreeId)
    }
    if (hatsContract && adminHatId) getHatTreeId()
  }, [adminHatId, hatsContract])

  // Optional: Fetch activity data
  const [jobTableName, setJobTableName] = useState<string | null>(null)
  const [marketplaceTableName, setMarketplaceTableName] = useState<
    string | null
  >(null)
  const [missionTableName, setMissionTableName] = useState<string | null>(null)

  useEffect(() => {
    if (!fetchActivityData) return

    async function getTableNames() {
      if (!fetchActivityData) return

      try {
        if (fetchActivityData.jobTableContract) {
          const jobName: any = await readContract({
            contract: fetchActivityData.jobTableContract,
            method: 'getTableName' as string,
            params: [],
          })
          setJobTableName(jobName)
        }

        if (fetchActivityData.marketplaceTableContract) {
          const marketplaceName: any = await readContract({
            contract: fetchActivityData.marketplaceTableContract,
            method: 'getTableName' as string,
            params: [],
          })
          setMarketplaceTableName(marketplaceName)
        }

        if (fetchActivityData.missionTableContract) {
          const missionName: any = await readContract({
            contract: fetchActivityData.missionTableContract,
            method: 'getTableName' as string,
            params: [],
          })
          setMissionTableName(missionName)
        }
      } catch (err) {
        console.error('Error fetching table names:', err)
        setActivityError(err as Error)
      }
    }
    getTableNames()
  }, [fetchActivityData])

  // Build SQL statements for activity data
  const jobStatement =
    fetchActivityData && jobTableName
      ? `SELECT * FROM ${jobTableName} WHERE teamId = ${fetchActivityData.teamId}`
      : null
  const listingStatement =
    fetchActivityData && marketplaceTableName
      ? `SELECT * FROM ${marketplaceTableName} WHERE teamId = ${fetchActivityData.teamId}`
      : null
  const missionStatement =
    fetchActivityData && missionTableName
      ? `SELECT * FROM ${missionTableName} WHERE teamId = ${fetchActivityData.teamId}`
      : null

  // Fetch activity data with SWR
  const { data: jobData } = useTablelandQuery(jobStatement, {
    revalidateOnFocus: false,
  })
  const { data: listingData } = useTablelandQuery(listingStatement, {
    revalidateOnFocus: false,
  })
  const { data: missionRows } = useTablelandQuery(missionStatement, {
    revalidateOnFocus: false,
  })

  // Update jobs
  useEffect(() => {
    if (jobData) {
      setJobs(jobData)
    }
  }, [jobData])

  // Update listings
  useEffect(() => {
    if (listingData) {
      setListings(listingData)
    }
  }, [listingData])

  // Process mission rows
  useEffect(() => {
    async function processMissions() {
      if (!missionRows || !fetchActivityData?.jbControllerContract) return

      try {
        const processedMissions = await Promise.all(
          missionRows.map(async (row: any) => {
            const metadataURI: any = await readContract({
              contract: fetchActivityData.jbControllerContract,
              method: 'uriOf' as string,
              params: [row.projectId],
            })
            const metadataRes = await fetch(
              `https://ipfs.io/ipfs/${metadataURI?.replace('ipfs://', '')}`
            )
            const metadata = await metadataRes.json()

            return {
              id: row.id,
              teamId: row.teamId,
              projectId: row.projectId,
              fundingGoal: Number(row.fundingGoal),
              metadata: metadata,
            }
          })
        )

        const filteredMissions = processedMissions.filter((mission) => {
          return !BLOCKED_MISSIONS.has(mission.id)
        })

        setMissions(filteredMissions.toReversed())
      } catch (err) {
        console.error('Error processing missions:', err)
        setActivityError(err as Error)
      }
    }

    processMissions()
  }, [missionRows, fetchActivityData])

  // Update activity loading state
  useEffect(() => {
    if (!fetchActivityData) {
      setIsLoadingActivityData(false)
      return
    }

    setIsLoadingActivityData(true)

    const allDataLoaded =
      (jobTableName ? jobData !== undefined : true) &&
      (marketplaceTableName ? listingData !== undefined : true) &&
      (missionTableName
        ? missions.length > 0 || missionRows?.length === 0
        : true)

    if (allDataLoaded) {
      setIsLoadingActivityData(false)
    }
  }, [
    jobData,
    listingData,
    missions,
    jobTableName,
    marketplaceTableName,
    missionTableName,
    missionRows,
    fetchActivityData,
  ])

  return {
    socials,
    isPublic,
    isDeleted,
    hatTreeId,
    adminHatId,
    managerHatId,
    isManager,
    isLoading,
    subIsValid,
    hasFullAccess,
    // Activity data (only populated if fetchActivityData is provided)
    jobs,
    listings,
    missions,
    isLoadingActivityData,
    activityError,
  }
}
