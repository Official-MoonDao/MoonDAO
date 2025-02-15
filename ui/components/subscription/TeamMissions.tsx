import { ShareIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { readContract } from 'thirdweb'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import CollapsibleContainer from '../layout/CollapsibleContainer'
import PaginationButtons from '../layout/PaginationButtons'
import SlidingCardMenu from '../layout/SlidingCardMenu'
import StandardButton from '../layout/StandardButton'
import { Mission } from '../mission/MissionCard'
import MissionStat from '../mission/MissionStat'

type TeamMissionProps = {
  mission: Mission
  jbControllerContract: any
  jbTokensContract: any
  teamContract: any
}

type TeamMissionsProps = {
  teamId: number
  isManager: boolean
  missionTableContract: any
  jbControllerContract: any
  jbTokensContract: any
  teamContract: any
}

export function TeamMission({
  mission,
  jbControllerContract,
  jbTokensContract,
  teamContract,
}: TeamMissionProps) {
  const { subgraphData } = useJBProjectData(
    mission?.projectId,
    jbControllerContract,
    jbTokensContract,
    teamContract
  )
  return (
    <div
      id={`team-mission-${mission.id}`}
      className="relative flex flex-col gap-5 w-[300px] md:w-full bg-dark-cool p-4 rounded-2xl"
    >
      <StandardButton
        className="absolute top-4 right-4 gradient-2 h-[30px] w-[30px] flex items-center justify-center"
        onClick={(e: any) => {
          e.stopPropagation()
          const link = `${window.location.origin}/team/${mission.teamId}?mission=${mission.id}`
          navigator.clipboard.writeText(link)
          toast.success('Link copied to clipboard', { style: toastStyle })
        }}
        hoverEffect={false}
      >
        <div className="flex items-center gap-2">
          <ShareIcon className="h-4 w-4" />
        </div>
      </StandardButton>
      <div className="flex flex-col md:flex-row items-center gap-12">
        {mission?.metadata.logoUri ? (
          <Image
            className="w-[200px] h-[200px] rounded-full"
            src={mission?.metadata.logoUri as string}
            alt="Mission image"
            width={100}
            height={100}
          />
        ) : (
          <div className="w-[100px] h-[100px] animate-pulse bg-dark-cool rounded-full" />
        )}
        <div className="flex flex-col gap-2">
          <h2 className="font-GoodTimes text-2xl">{mission?.metadata.name}</h2>
          <div
            id="selected-mission-stats"
            className="font-GoodTimes text-sm grid grid-cols-2 lg:grid-cols-3 max-w-[400px]"
          >
            <MissionStat
              label="VOLUME"
              value={
                subgraphData?.volume ? 'Ξ' + subgraphData?.volume : undefined
              }
            />
            <MissionStat label="PAYMENTS" value={subgraphData?.paymentsCount} />
            <MissionStat
              label="CREATED"
              value={
                subgraphData?.createdAt
                  ? new Date(
                      subgraphData?.createdAt * 1000
                    ).toLocaleDateString()
                  : undefined
              }
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {mission?.metadata?.description?.length > 100 ? (
            <CollapsibleContainer minHeight={'100px'} rightAlign>
              <p>{mission?.metadata.description}</p>
            </CollapsibleContainer>
          ) : (
            <p className="h-[115px]">{mission?.metadata.description}</p>
          )}
        </div>
        <StandardButton
          className="gradient-2 rounded-full"
          link={`https://sepolia.juicebox.money/v4/p/${mission?.projectId}`}
          target="_blank"
        >
          {'Contribute'}
        </StandardButton>
      </div>
    </div>
  )
}

export default function TeamMissions({
  teamId,
  isManager,
  missionTableContract,
  jbControllerContract,
  jbTokensContract,
  teamContract,
}: TeamMissionsProps) {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>()
  const [pageIdx, setPageIdx] = useState(1)
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

  useEffect(() => {
    async function getTeamMissions() {
      const misionTableName = await readContract({
        contract: missionTableContract,
        method: 'getTableName' as string,
        params: [],
      })
      const statement = `SELECT * FROM ${misionTableName} WHERE teamId = ${teamId}`
      const rowsRes = await fetch(`/api/tableland/query?statement=${statement}`)
      const rows = await rowsRes.json()
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
            metadata: metadata,
          }
        })
      )
      setMissions(missions.toReversed())
    }

    if (missionTableContract && jbControllerContract) getTeamMissions()
  }, [teamId, missionTableContract, jbControllerContract])

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
                mission={mission}
                jbControllerContract={jbControllerContract}
                jbTokensContract={jbTokensContract}
                teamContract={teamContract}
              />
            ))}
      </div>
      <div className="mt-4">
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
