//EntityJobs.tsx
import { TABLELAND_ENDPOINT } from 'const/config'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Job, { Job as JobType } from '../jobs/Job'
import SlidingCardMenu from '../layout/SlidingCardMenu'
import StandardButton from '../layout/StandardButton'
import Card from './Card'
import TeamJobModal from './TeamJobModal'

type TeamJobsProps = {
  teamId: string
  jobTableContract: any
  isManager: boolean
  isCitizen: any
}

export default function TeamJobs({
  teamId,
  jobTableContract,
  isManager,
  isCitizen,
}: TeamJobsProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobType[]>()
  const [teamJobModalEnabled, setTeamJobModalEnabled] = useState(false)

  async function getEntityJobs() {
    const jobBoardTableName = await jobTableContract.call('getTableName')
    const statement = `SELECT * FROM ${jobBoardTableName} WHERE teamId = ${teamId}`

    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
    const data = await res.json()

    setJobs(data)
  }

  const jobIcon = '/./assets/icon-job.svg'

  useEffect(() => {
    if (jobTableContract) getEntityJobs()
  }, [teamId, jobTableContract])

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
        const jobElement = document.getElementById(
          `team-job-${router.query.job}`
        )
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

  return (
    <section
      id="jobs section"
      className="bg-slide-section mb-5 p-5 md:pr-0 md:pb-10 rounded-tl-[2vmax] rounded-bl-[5vmax]"
    >
      <Card className="w-full flex flex-col justify-between gap-5">
        <div
          id="job-title-container"
          className="flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center pr-12"
        >
          <div className="flex pb-5 gap-5 opacity-[50%]">
            <Image src={jobIcon} alt="Job icon" width={30} height={30} />
            <p className="header font-GoodTimes">Open Job Board</p>
          </div>{' '}
          {isManager && (
            <StandardButton
              className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px]"
              onClick={() => {
                setTeamJobModalEnabled(true)
              }}
            >
              Add a Job
            </StandardButton>
          )}
        </div>
        {isManager || isCitizen ? (
          <SlidingCardMenu id="team-jobs-sliding-card-menu">
            <div className="flex gap-4">
              {jobs?.[0] ? (
                jobs.map((job, i) => (
                  <Job
                    id={`team-job-${job.id}`}
                    key={`team-job-${job.id}`}
                    job={job}
                    jobTableContract={jobTableContract}
                    editable={isManager}
                    refreshJobs={getEntityJobs}
                  />
                ))
              ) : (
                <p className="p-4 pt-6">{`This team hasn't listed any open roles yet.`}</p>
              )}
            </div>
          </SlidingCardMenu>
        ) : (
          <div className="flex flex-col gap-4 ">
            <p>
              {
                '⚠️ You must be a Citizen of the Space Acceleration Network or a Manager of the team to view the job board. If you are already a Citizen or Manager, please sign in.'
              }
            </p>
            <StandardButton
              className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px]"
              onClick={() => {
                router.push('/citizen')
              }}
            >
              Become a Citizen
            </StandardButton>
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
      </Card>
    </section>
  )
}
