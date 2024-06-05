import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState } from 'react'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import EntityJobModal from '../subscription/EntityJobModal'

export type Job = {
  id: number
  entityId: number
  title: string
  description: string
  contactInfo: string
}

type JobProps = {
  job: Job
  jobTableContract?: any
  refreshJobs?: any
  editable?: boolean
  entityId?: string
}

export default function Job({
  job,
  jobTableContract,
  refreshJobs,
  editable,
  entityId,
}: JobProps) {
  const [enabledEditJobModal, setEnabledEditJobModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <div className="p-2 flex flex-col justify-between border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm gap-2">
      <div className="flex justify-between">
        <p className="font-bold">{job.title}</p>
        {editable && (
          <div className="flex gap-4">
            <button onClick={() => setEnabledEditJobModal(true)}>
              {!isDeleting && (
                <PencilIcon className="h-6 w-6 text-moon-orange" />
              )}
            </button>
            {isDeleting ? (
              <LoadingSpinner className="scale-[75%]" />
            ) : (
              <button
                onClick={async () => {
                  setIsDeleting(true)
                  try {
                    await jobTableContract.call('deleteFromTable', [
                      job.id,
                      entityId,
                    ])
                    setTimeout(() => {
                      refreshJobs()
                      setIsDeleting(false)
                    }, 25000)
                  } catch (err) {
                    console.log(err)
                    setIsDeleting(false)
                  }
                }}
              >
                <TrashIcon className="h-6 w-6 text-moon-orange" />
              </button>
            )}
            {enabledEditJobModal && (
              <EntityJobModal
                entityId={entityId as any}
                setEnabled={setEnabledEditJobModal}
                jobTableContract={jobTableContract}
                job={job}
                edit
                refreshJobs={refreshJobs}
              />
            )}
          </div>
        )}
      </div>
      <p>{job.description}</p>
      <Link
        href={job.contactInfo}
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 w-[100px] border-2 border-moon-orange text-moon-orange rounded-full"
      >
        Link to Job
      </Link>
    </div>
  )
}
