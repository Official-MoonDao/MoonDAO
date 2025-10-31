import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import Job, { Job as JobType } from '../jobs/Job'
import SlidingCardMenu from '../layout/SlidingCardMenu'
import StandardButton from '../layout/StandardButton'

type LatestJobsProps = {
  teamContract: any
  jobTableContract: any
}

export default function LatestJobs({
  teamContract,
  jobTableContract,
}: LatestJobsProps) {
  const router = useRouter()
  const [latestJobs, setLatestJobs] = useState<JobType[]>([])
  const [tableName, setTableName] = useState<string | null>(null)

  // Get table name from contract
  useEffect(() => {
    async function getTableName() {
      if (!jobTableContract) return
      try {
        const name: any = await readContract({
          contract: jobTableContract,
          method: 'getTableName' as string,
          params: [],
        })
        setTableName(name)
      } catch (error) {
        console.error('Error fetching table name:', error)
      }
    }
    getTableName()
  }, [jobTableContract])

  // Build statement with current timestamp
  const now = Math.floor(Date.now() / 1000)
  const statement = tableName
    ? `SELECT * FROM ${tableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC LIMIT 25`
    : null

  const { data: jobs } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  // Process and filter jobs
  useEffect(() => {
    async function processJobs() {
      if (!jobs || !teamContract) return

      const validJobs = await Promise.all(
        jobs
          .map(async (job: JobType) => {
            try {
              const teamExpiration = await readContract({
                contract: teamContract,
                method: 'expiresAt' as string,
                params: [job.teamId],
              })
              return +teamExpiration.toString() > now ? job : null
            } catch {
              return null
            }
          })
          .filter((job: any) => job !== null)
      )

      setLatestJobs(validJobs)
    }

    processJobs()
  }, [jobs, teamContract, now])

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-10 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pr-12">
        <div className="flex gap-5 opacity-[50%]">
          <h2 className="header font-GoodTimes">Latest Jobs</h2>
        </div>

        <StandardButton
          className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
          onClick={() => router.push('/jobs')}
        >
          See More
        </StandardButton>
      </div>

      <SlidingCardMenu>
        <div id="latest-jobs-container" className="flex gap-5">
          {latestJobs.map((job, i) => (
            <Job
              key={`job-${i}`}
              job={job}
              showTeam
              teamContract={teamContract}
            />
          ))}
        </div>
      </SlidingCardMenu>
    </div>
  )
}
