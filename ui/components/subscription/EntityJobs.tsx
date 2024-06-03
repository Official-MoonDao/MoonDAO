import { useEffect, useState } from 'react'
import Job from '../jobs/Job'
import Card from './Card'

type EntityJobsProps = {
  entityId: string
}

const dummyJobs = [
  {
    entityId: '2',
    title: 'Software Engineer',
    description:
      'We are looking for a software engineer to join our team.We are looking for a software engineer to join our team.We are looking for a software engineer to join our team.We are looking for a software engineer to join our team.We are looking for a software engineer to join our team',
    contact: 'info@moondao.com',
  },
  {
    entityId: '2',
    title: 'Community Manager',
    description: 'We are looking for a community manager to join our team',
    contact: 'info@moondao.com',
  },
  {
    entityId: '2',
    title: 'Product Manager',
    description: 'We are looking for a product manager to join our team',
    contact: 'info@moondao.com',
  },
  {
    entityId: '2',
    title: 'Designer',
    description: 'We are looking for a designer to join our team',
    contact: 'info@moondao.com',
  },
]

export default function EntityJobs({ entityId }: EntityJobsProps) {
  const [jobs, setJobs] = useState(dummyJobs)

  function getEntityJobs() {}

  useEffect(() => {}, [entityId])

  return (
    <Card className="w-full flex flex-col justify-between gap-4">
      <p className="text-2xl">Jobs</p>
      <div className="flex flex-col max-h-[500px] overflow-auto gap-4">
        {jobs &&
          jobs.map((job, i) => <Job key={`entity-job-${i}`} job={job} />)}
      </div>
    </Card>
  )
}
