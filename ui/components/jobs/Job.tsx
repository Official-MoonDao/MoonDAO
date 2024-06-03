export type Job = {
  entityId: string
  title: string
  description: string
  contact: string
}

type JobProps = {
  job: Job
}

export default function Job({ job }: JobProps) {
  return (
    <div className="p-2 flex flex-col justify-between border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm gap-2">
      <p className="font-bold">{job.title}</p>
      <p>{job.description}</p>
      <p className="italic">{job.contact}</p>
    </div>
  )
}
