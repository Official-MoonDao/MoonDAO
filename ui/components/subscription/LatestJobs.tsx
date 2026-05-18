import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import { readContract } from 'thirdweb'
import { JOBS_TABLE_NAMES } from 'const/config'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { getChainSlug } from '@/lib/thirdweb/chain'
import Job, { Job as JobType } from '../jobs/Job'
import SlidingCardMenu from '../layout/SlidingCardMenu'
import StandardButton from '../layout/StandardButton'

type LatestJobsProps = {
  teamContract: any
  jobTableContract: any
}

export default function LatestJobs({ teamContract, jobTableContract }: LatestJobsProps) {
  const router = useRouter()
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [latestJobs, setLatestJobs] = useState<JobType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tableName, setTableName] = useState<string | null>(null)
  
  // Memoize 'now' to prevent unnecessary re-renders and effect re-runs
  const now = useMemo(() => Math.floor(Date.now() / 1000), [])

  // Get table name from contract, fall back to config constant
  useEffect(() => {
    async function getTableName() {
      const fallback = JOBS_TABLE_NAMES[chainSlug] || null
      if (!jobTableContract) {
        setTableName(fallback)
        return
      }
      try {
        const name: any = await readContract({
          contract: jobTableContract,
          method: 'getTableName' as string,
          params: [],
        })
        setTableName(name || fallback)
      } catch (error) {
        console.error('Error fetching table name:', error)
        setTableName(fallback)
      }
    }
    getTableName()
  }, [jobTableContract, chainSlug])

  // Build statement with memoized timestamp
  const statement = tableName
    ? `SELECT * FROM ${tableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC LIMIT 25`
    : null

  // If tableName resolved to null (no contract + no fallback), stop skeleton
  useEffect(() => {
    if (tableName === null && jobTableContract === null) {
      setIsLoading(false)
    }
  }, [tableName, jobTableContract])

  const { data: jobs } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  // Process and filter jobs
  useEffect(() => {
    async function processJobs() {
      if (!jobs) return // still loading — don't clear
      if (!teamContract || jobs.length === 0) {
        setLatestJobs([])
        setIsLoading(false)
        return
      }

      const resolvedJobs = await Promise.all(
        jobs.map(async (job: JobType) => {
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
      )

      const validJobs = resolvedJobs.filter((job): job is JobType => job !== null)

      setLatestJobs(validJobs)
      setIsLoading(false)
    }

    processJobs()
  }, [jobs, teamContract, now])

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-6">
        <h2 className="font-GoodTimes text-2xl text-white">Latest Jobs</h2>
        <StandardButton
          className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
          onClick={() => router.push('/jobs')}
        >
          See More
        </StandardButton>
      </div>

      <SlidingCardMenu>
        <div id="latest-jobs-container" className="flex gap-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="w-[300px] flex-shrink-0 h-[200px] rounded-xl bg-slate-700/40 animate-pulse"
              />
            ))
          ) : (
            latestJobs.map((job, i) => (
              <Job key={`job-${i}`} job={job} showTeam teamContract={teamContract} />
            ))
          )}
        </div>
      </SlidingCardMenu>
      {!isLoading && latestJobs.length === 0 && (
        <p className="text-slate-400 text-sm py-4 text-center">No open positions at the moment.</p>
      )}
    </div>
  )
}
