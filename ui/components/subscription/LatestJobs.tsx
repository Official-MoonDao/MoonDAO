import { TABLELAND_ENDPOINT } from 'const/config'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import Job, { Job as JobType } from '@/components/jobs/Job'
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

  useEffect(() => {
    //get latest 25 jobs
    async function getLatestJobs() {
      const now = Math.floor(Date.now() / 1000)
      const tableName = await readContract({
        contract: jobTableContract,
        method: 'getTableName' as string,
        params: [],
      })
      const statement = `SELECT * FROM ${tableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC LIMIT 25`
      const latestJobsRes = await fetch(
        `${TABLELAND_ENDPOINT}?statement=${statement}`
      )
      const jobs = await latestJobsRes.json()
      const validJobs = jobs.filter(async (job: JobType) => {
        const teamExpiration = await readContract({
          contract: teamContract,
          method: 'expiresAt' as string,
          params: [job.teamId],
        })
        return +teamExpiration.toString() > now
      })
      setLatestJobs(validJobs)
    }
    if (teamContract && jobTableContract) {
      getLatestJobs()
    }
  }, [teamContract, jobTableContract])

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
