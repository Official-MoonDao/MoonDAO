import { BLOCKED_MISSIONS } from 'const/whitelist'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import JuiceProviders from '@/lib/juicebox/JuiceProviders'
import useMissionData from '@/lib/mission/useMissionData'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import PaginationButtons from '../layout/PaginationButtons'
import StandardButton from '../layout/StandardButton'
import { Mission } from '../mission/MissionCard'
import MissionWideCard from '../mission/MissionWideCard'

type TeamMissionProps = {
  mission: Mission
  missionTableContract: any
  missionCreatorContract: any
  jbControllerContract: any
  jbDirectoryContract: any
  jbTokensContract: any
  teamContract: any
  isManager: boolean
  selectedChain: any
}

type TeamMissionsProps = {
  teamId: number
  isManager: boolean
  selectedChain: any
  missionTableContract: any
  missionCreatorContract: any
  jbControllerContract: any
  jbDirectoryContract: any
  jbTokensContract: any
  teamContract: any
}

export function TeamMission({
  selectedChain,
  mission,
  missionTableContract,
  missionCreatorContract,
  jbControllerContract,
  jbDirectoryContract,
  jbTokensContract,
  teamContract,
  isManager,
}: TeamMissionProps) {
  const {
    subgraphData,
    token,
    fundingGoal,
    ruleset,
    primaryTerminalAddress,
    deadline,
  } = useMissionData({
    mission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    teamContract,
  })

  return (
    <JuiceProviders
      projectId={mission?.projectId}
      selectedChain={selectedChain}
    >
      <MissionWideCard
        mission={mission}
        token={token}
        subgraphData={subgraphData}
        fundingGoal={mission.fundingGoal}
        ruleset={ruleset}
        deadline={deadline}
        contribute
        editable={isManager}
        showMore={false}
        linkToMission
        selectedChain={selectedChain}
        primaryTerminalAddress={primaryTerminalAddress}
        teamContract={teamContract}
      />
    </JuiceProviders>
  )
}

export default function TeamMissions({
  selectedChain,
  teamId,
  isManager,
  missionTableContract,
  missionCreatorContract,
  jbControllerContract,
  jbDirectoryContract,
  jbTokensContract,
  teamContract,
}: TeamMissionsProps) {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>()
  const [pageIdx, setPageIdx] = useState(1)
  const [tableName, setTableName] = useState<string | null>(null)
  const maxPage = missions?.length || 0
  const shallowQueryRoute = useShallowQueryRoute()

  function handlePageChange(newPage: number) {
    const nextMission = missions?.[newPage - 1]
    setPageIdx(newPage)
    shallowQueryRoute({
      ...router.query,
      mission: nextMission?.id,
    })
  }

  // Get table name from contract
  useEffect(() => {
    async function getTableName() {
      if (!missionTableContract) return
      try {
        const name: any = await readContract({
          contract: missionTableContract,
          method: 'getTableName' as string,
          params: [],
        })
        setTableName(name)
      } catch (error) {
        console.error('Error fetching table name:', error)
      }
    }
    getTableName()
  }, [missionTableContract])

  // Build statement and fetch with SWR
  const statement = tableName
    ? `SELECT * FROM ${tableName} WHERE teamId = ${teamId}`
    : null
  const { data: rows, mutate } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  // Process rows when they arrive
  useEffect(() => {
    async function processRows() {
      if (!rows || !jbControllerContract) return

      const missions = await Promise.all(
        rows.map(async (row: any) => {
          const metadataURI: any = await readContract({
            contract: jbControllerContract,
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
            fundingGoal: row.fundingGoal,
            metadata: metadata,
          }
        })
      )
      const filteredMissions = missions.filter((mission) => {
        return !BLOCKED_MISSIONS.has(mission.id)
      })
      setMissions(filteredMissions.toReversed())
    }

    processRows()
  }, [rows, jbControllerContract])

  //Scroll to mission
  useEffect(() => {
    if (router.query.mission && missions) {
      const missionBoard = document.getElementById('team-missions')
      if (missionBoard) {
        missionBoard.scrollIntoView({ behavior: 'smooth' })
      }

      const missionId = router.query.mission
      const missionIndex = missions?.findIndex(
        (mission) => mission.id === Number(missionId)
      )
      if (missionIndex) {
        setPageIdx(missionIndex + 1)
      }
    }
  }, [router, missions])

  if (!missions?.[0]) return null

  return (
    <div
      id="team-missions"
      className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
        <div className="flex gap-5 opacity-[50%]">
          <Image
            src={'/assets/icon-marketplace.svg'}
            alt="Marketplace icon"
            width={30}
            height={30}
          />
          <h2 className="header font-GoodTimes">
            {missions.length > 1 ? 'Missions' : 'Mission'}
          </h2>
        </div>
        {isManager && (
          <StandardButton
            className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
            onClick={() => router.push('/launch')}
          >
            Create a Mission
          </StandardButton>
        )}
      </div>

      <div className="mt-4 flex gap-4 px-8">
        {missions?.[0] &&
          missions
            .slice(pageIdx - 1, pageIdx)
            .map((mission) => (
              <TeamMission
                key={mission.id}
                selectedChain={selectedChain}
                mission={mission}
                missionTableContract={missionTableContract}
                missionCreatorContract={missionCreatorContract}
                jbControllerContract={jbControllerContract}
                jbDirectoryContract={jbDirectoryContract}
                jbTokensContract={jbTokensContract}
                teamContract={teamContract}
                isManager={isManager}
              />
            ))}
      </div>
      <div className="mt-8">
        {missions?.length > 1 && (
          <PaginationButtons
            handlePageChange={handlePageChange}
            maxPage={maxPage}
            pageIdx={pageIdx}
            label="Mission"
          />
        )}
      </div>
    </div>
  )
}
