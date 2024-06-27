
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState } from 'react'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import EntityJobModal from '../subscription/EntityJobModal'
import Frame from '../layout/Frame'
import StandardButton from '../layout/StandardButton'

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
  showEntityId?: boolean
}

export default function Job({
  job,
  jobTableContract,
  refreshJobs,
  editable,
  entityId,
  showEntityId,
}: JobProps) {
  const [enabledEditJobModal, setEnabledEditJobModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <div className="flex flex-col justify-between">
      <Frame>
        <div className="flex justify-between items-end">
          <p className="font-bold font-GoodTimes pb-2">{job.title}</p>
          <div className="flex gap-2">
            {showEntityId && (
              <Link
                href={`/entity/${job.entityId}`}
                className="text-moon-orange"
              >{`Entity #${job.entityId}`}</Link>
            )}
            <div className="flex flex-col lg:flex-row pb-5 items-center gap-2 lg:gap-4">

                <StandardButton className='gradient-2 rounded-[5vmax] rounded-bl-[20px]'>
                  Apply
                </StandardButton>

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
          </div>
        </div>
        <p>{job.description}</p>
      </Frame>  
    </div>
  )
}
