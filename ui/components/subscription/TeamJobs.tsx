//EntityJobs.tsx
import { TABLELAND_ENDPOINT } from 'const/config'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import Job, { Job as JobType } from '../jobs/Job'
import StandardButton from '../layout/StandardButton'
import Button from './Button'
import Card from './Card'
import TeamJobModal from './TeamJobModal'

type TeamJobsProps = {
  teamId: string
  jobTableContract: any
  isManager: boolean
}

export default function TeamJobs({
  teamId,
  jobTableContract,
  isManager,
}: TeamJobsProps) {
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

  return (
    <section
      id="jobs section"
      className="bg-slide-section mb-5 p-5 rounded-tl-[2vmax] rounded-bl-[5vmax]"
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
        <div className="flex flex-col max-h-[500px] overflow-auto gap-4">
          {jobs?.[0] ? (
            jobs.map((job, i) => (
              <Job
                key={`team-job-${i}`}
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
