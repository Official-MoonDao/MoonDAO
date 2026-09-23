//EntityJobs.tsx
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import Job, { Job as JobType } from '../jobs/Job'
import JobCitizenUpsell from '../jobs/JobCitizenUpsell'
import StandardButton from '../layout/StandardButton'
import Card from './Card'
import TeamJobModal from './TeamJobModal'

type TeamJobsProps = {
  teamId: string
  jobTableContract: any
  isManager: boolean
  isCitizen: any
  hasFullAccess?: boolean
  jobs?: JobType[] // Optional: can be provided externally to avoid fetching
}

export default function TeamJobs({
  teamId,
  jobTableContract,
  isManager,
  isCitizen,
  hasFullAccess = false,
  jobs: externalJobs,
}: TeamJobsProps) {
  const router = useRouter()
  const [internalJobs, setInternalJobs] = useState<JobType[]>()
  const [teamJobModalEnabled, setTeamJobModalEnabled] = useState(false)
  const [tableName, setTableName] = useState<string | null>(null)

  const jobIcon = '/./assets/icon-job.svg'

  const shouldFetch = !externalJobs

  // Get table name from contract
  useEffect(() => {
    async function getTableName() {
      if (!jobTableContract || !shouldFetch) return
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
  }, [jobTableContract, shouldFetch])

  const statement =
    shouldFetch && tableName ? `SELECT * FROM ${tableName} WHERE teamId = ${teamId}` : null
  const { data, mutate } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (data) {
      setInternalJobs(data)
    }
  }, [data])

  const jobs = externalJobs || internalJobs

  const getEntityJobs = () => {
    mutate()
  }

  useEffect(() => {
    if (router.query.job) {
      function scrollToJobs() {
        // First scroll the section into view
        const jobBoard = document.getElementById('jobs section')
        if (jobBoard) {
          jobBoard.scrollIntoView({ behavior: 'smooth' })
        }
      }

      function scrollToJob() {
        const jobElement = document.getElementById(`team-job-${router.query.job}`)
        if (jobElement) {
          jobElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
          })
        }
      }

      // Wait for elements to be rendered
      const scrollToJobsTimeout = setTimeout(scrollToJobs, 3000)
      const scrollToJobTimeout = setTimeout(scrollToJob, 4000)

      return () => {
        clearTimeout(scrollToJobsTimeout)
        clearTimeout(scrollToJobTimeout)
      }
    }
  }, [router])

  if (!jobs?.[0]) return null

  return (
    <section id="jobs section" className="p-6">
      <div className="w-full flex flex-col justify-between gap-5">
        <div
          id="job-title-container"
          className="flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center mb-6"
        >
          <div className="flex gap-5 items-center">
            <Image src={jobIcon} alt="Job icon" width={30} height={30} className="opacity-70" />
            <h2 className="font-GoodTimes text-2xl text-white">Open Job Board</h2>
          </div>
          {isManager && (
            <StandardButton
              className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px] transition-all duration-200 hover:scale-105"
              onClick={() => {
                setTeamJobModalEnabled(true)
              }}
            >
              Add a Job
            </StandardButton>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {!isManager && !isCitizen && (
            <JobCitizenUpsell
              variant="banner"
              headline="Read the roles. Apply as a Citizen."
              body="This team's open opportunities are public. Citizenship unlocks the apply link and how-to-apply steps."
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <Job
                id={`team-job-${job.id}`}
                key={`team-job-${job.id}`}
                job={job}
                jobTableContract={jobTableContract}
                editable={isManager}
                refreshJobs={getEntityJobs}
                previewMode={false}
              />
            ))}
          </div>
        </div>

        {teamJobModalEnabled && (
          <TeamJobModal
            setEnabled={setTeamJobModalEnabled}
            teamId={teamId}
            jobTableContract={jobTableContract}
            refreshJobs={getEntityJobs}
          />
        )}
      </div>
    </section>
  )
}
