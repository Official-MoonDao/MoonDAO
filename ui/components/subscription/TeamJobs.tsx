//EntityJobs.tsx
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import Job, { Job as JobType } from '../jobs/Job'
import Button from '../layout/Button'
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
          className="flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center"
        >
          <div className="flex gap-5">
            <Image src={jobIcon} alt="Job icon" width={30} height={30} className="opacity-70" />
            <h2 className="font-GoodTimes text-2xl text-white">Open Job Board</h2>
          </div>{' '}
          {isManager && (
            <Button
              variant="gradient"
              borderRadius="rounded-[2vmax] rounded-bl-[10px]"
              className="min-w-[200px] gradient-2 transition-all duration-200 hover:scale-105"
              onClick={() => {
                setTeamJobModalEnabled(true)
              }}
            >
              Add a Job
            </Button>
          )}
        </div>
        {isManager || isCitizen ? (
          <div className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {jobs?.[0] ? (
                jobs.map((job, i) => (
                  <Job
                    id={`team-job-${job.id}`}
                    key={`team-job-${job.id}`}
                    job={job}
                    jobTableContract={jobTableContract}
                    editable={isManager}
                    refreshJobs={getEntityJobs}
                    previewMode={!hasFullAccess}
                  />
                ))
              ) : (
                <p className="text-slate-300 text-center py-8 col-span-2">{`This team hasn't listed any open roles yet.`}</p>
              )}
            </div>
          </div>
        ) : jobs?.[0] ? (
          // Show preview for non-citizens
          <div className="mt-4">
            <div className="bg-slate-800/50 rounded-xl border border-slate-600/30 p-6 mb-4">
              <div className="text-center">
                <h4 className="text-lg font-semibold text-white mb-2">
                  🔒 {jobs.length} Job{jobs.length !== 1 ? 's' : ''} Available
                </h4>
                <p className="text-slate-300 mb-4">
                  This team has active job postings. Become a Citizen to view full details, salary
                  information, and application links.
                </p>
                <Button
                  variant="gradient"
                  borderRadius="rounded-[2vmax] rounded-bl-[10px]"
                  className="min-w-[200px] gradient-2"
                  onClick={() => {
                    router.push('/citizen')
                  }}
                >
                  Become a Citizen
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-50 pointer-events-none">
              {jobs.slice(0, 3).map((job, i) => (
                <Job
                  id={`team-job-preview-${job.id}`}
                  key={`team-job-preview-${job.id}`}
                  job={job}
                  jobTableContract={jobTableContract}
                  editable={false}
                  refreshJobs={getEntityJobs}
                  previewMode={true}
                />
              ))}
              {jobs.length > 3 && (
                <div className="bg-slate-700/30 rounded-xl border border-slate-600/30 p-6 flex items-center justify-center min-h-[200px]">
                  <p className="text-slate-400 text-center">
                    +{jobs.length - 3} more job
                    {jobs.length - 3 !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 ">
            <p>
              {
                '⚠️ You must be a Citizen of the Space Acceleration Network or a Manager of the team to view the job board. If you are already a Citizen or Manager, please sign in.'
              }
            </p>
            <Button
              variant="gradient"
              borderRadius="rounded-[2vmax] rounded-bl-[10px]"
              className="min-w-[200px] gradient-2"
              onClick={() => {
                router.push('/citizen')
              }}
            >
              Become a Citizen
            </Button>
          </div>
        )}

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
