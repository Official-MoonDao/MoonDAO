//EntityJobs.tsx
import { TABLELAND_ENDPOINT } from 'const/config'
import { useEffect, useState } from 'react'
import Job, { Job as JobType } from '../jobs/Job'
import Button from './Button'
import Card from './Card'
import EntityJobModal from './EntityJobModal'
import Image from 'next/image'

type EntityJobsProps = {
  entityId: string
  jobTableContract: any
  isManager: boolean
}

export default function EntityJobs({
  entityId,
  jobTableContract,
  isManager,
}: EntityJobsProps) {
  const [jobs, setJobs] = useState<JobType[]>()
  const [entityJobModalEnabled, setEntityJobModalEnabled] = useState(false)

  async function getEntityJobs() {
    const jobBoardTableName = await jobTableContract.call('getTableName')
    const statement = `SELECT * FROM ${jobBoardTableName} WHERE entityId = ${entityId}`

    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
    const data = await res.json()

    setJobs(data)
  }

  const jobIcon = '/./assets/icon-job.svg'

  useEffect(() => {
    if (jobTableContract) getEntityJobs()
  }, [entityId, jobTableContract])

  return (
  <section id="jobs section"
    className='bg-slide-section p-5 rounded-tl-[2vmax] rounded-bl-[5vmax]'
    >
    <Card className="w-full flex flex-col justify-between gap-5">
      <div id="job-title-container" 
        className="flex gap-5 items-center opacity-[50%]"
        >
        <Image src={jobIcon} alt="Job icon" width={30} height={30} />
        <p className="header font-GoodTimes">Open Job Board</p>
      </div>
      <div className="flex flex-col max-h-[500px] overflow-auto gap-4">
        {jobs?.[0] ? (
          jobs.map((job, i) => (
            <Job
              key={`entity-job-${i}`}
              job={job}
              jobTableContract={jobTableContract}
              entityId={entityId}
              editable={isManager}
              refreshJobs={getEntityJobs}
            />
          ))
        ) : (
          <p>{`This team hasn't listed any open roles yet.`}</p>
        )}
      </div>
      {isManager && (
        <Button
          onClick={() => {
            setEntityJobModalEnabled(true)
          }}
        >
          Add a Job
        </Button>
      )}
      {entityJobModalEnabled && (
        <EntityJobModal
          setEnabled={setEntityJobModalEnabled}
          entityId={entityId}
          jobTableContract={jobTableContract}
          refreshJobs={getEntityJobs}
        />
      )}
    </Card>
  </section>    
  )
}
