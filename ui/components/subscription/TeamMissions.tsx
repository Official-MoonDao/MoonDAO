import { BLOCKED_MISSIONS } from 'const/whitelist'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import StandardButton from '../layout/StandardButton'
import StandardDetailCard from '../layout/StandardDetailCard'
import { Mission } from '../mission/MissionCard'

type TeamMissionsProps = {
  teamId: number
  isManager: boolean
  missionTableContract: any
  jbControllerContract: any
  missions?: Mission[]
}

export default function TeamMissions({
  teamId,
  isManager,
  missionTableContract,
  jbControllerContract,
  missions: externalMissions,
}: TeamMissionsProps) {
  const router = useRouter()
  const [internalMissions, setInternalMissions] = useState<Mission[]>()
  const [tableName, setTableName] = useState<string | null>(null)

  const missions = externalMissions || internalMissions
  const shouldFetch = !externalMissions

  useEffect(() => {
    async function getTableName() {
      if (!missionTableContract || !shouldFetch) return
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
  }, [missionTableContract, shouldFetch])

  const statement =
    shouldFetch && tableName ? `SELECT * FROM ${tableName} WHERE teamId = ${teamId}` : null
  const { data: rows } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    async function processRows() {
      if (!rows || !jbControllerContract || !shouldFetch) return

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
      setInternalMissions(filteredMissions.toReversed())
    }

    processRows()
  }, [rows, jbControllerContract, shouldFetch])

  if (!missions?.[0]) return null

  return (
    <section id="team-missions" className="p-6">
      <div className="flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center mb-6">
        <div className="flex gap-5 items-center">
          <Image
            src={'/assets/icon-marketplace.svg'}
            alt="Missions icon"
            width={30}
            height={30}
            className="opacity-70 flex-shrink-0"
          />
          <h2 className="font-GoodTimes text-2xl text-white">
            {missions.length > 1 ? 'Missions' : 'Mission'}
          </h2>
        </div>
        {isManager && (
          <StandardButton
            className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px] transition-all duration-200 hover:scale-105"
            onClick={() => router.push('/launch')}
          >
            Create a Mission
          </StandardButton>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {missions.map((mission) => (
          <StandardDetailCard
            key={mission.id}
            title={mission.metadata?.name}
            paragraph={mission.metadata?.tagline}
            image={getIPFSGateway(mission.metadata?.logoUri)}
            link={`/mission/${mission.id}`}
          />
        ))}
      </div>
    </section>
  )
}
