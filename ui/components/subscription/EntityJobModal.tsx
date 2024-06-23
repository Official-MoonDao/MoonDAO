import { XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import toast from 'react-hot-toast'
import isTextInavlid from '@/lib/tableland/isTextValid'
import { Job } from '../jobs/Job'

type JobData = {
  title: string
  description: string
  contactInfo: string
}

type EntityJobModalProps = {
  entityId: string
  setEnabled: Function
  refreshJobs: Function
  jobTableContract: any
  edit?: boolean
  job?: Job
}

export default function EntityJobModal({
  entityId,
  setEnabled,
  refreshJobs,
  jobTableContract,
  edit,
  job,
}: EntityJobModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [jobData, setJobData] = useState<JobData>(
    edit
      ? {
          title: job?.title || '',
          description: job?.description || '',
          contactInfo: job?.contactInfo || '',
        }
      : {
          title: '',
          description: '',
          contactInfo: '',
        }
  )

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-job-modal-backdrop') setEnabled(false)
      }}
      id="entity-job-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            jobData.title.trim() === '' ||
            jobData.description.trim() === '' ||
            jobData.contactInfo.trim() === ''
          )
            return toast.error('Please fill out all fields')

          setIsLoading(true)

          const invalidText = Object.values(jobData).some((v: any) =>
            isTextInavlid(v)
          )

          if (invalidText) {
            return setIsLoading(false)
          }

          try {
            if (edit) {
              await jobTableContract.call('updateTable', [
                job?.id,
                jobData.title,
                jobData.description,
                entityId,
                jobData.contactInfo,
              ])
            } else {
              await jobTableContract?.call('insertIntoTable', [
                jobData.title,
                jobData.description,
                entityId,
                jobData.contactInfo,
              ])
            }

            setTimeout(() => {
              refreshJobs()
              setIsLoading(false)
              setEnabled(false)
            }, 25000)
          } catch (err: any) {
            console.log(err)
            setIsLoading(false)
          }
        }}
      >
        <div className="w-full flex items-center justify-between">
          <p>{edit ? 'Edit a Job' : 'Add a Job'}</p>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Title"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setJobData({ ...jobData, title: e.target.value })
          }}
          value={jobData.title}
        />
        <textarea
          placeholder="Description"
          className="w-full h-[250px] p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setJobData({ ...jobData, description: e.target.value })
          }}
          value={jobData.description}
          style={{ resize: 'none' }}
          maxLength={500}
        />
        <input
          type="text"
          placeholder="Link"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setJobData({ ...jobData, contactInfo: e.target.value })
          }}
          value={jobData.contactInfo}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 px-2 w-[100px] border-2 border-moon-orange text-moon-orange rounded-full"
        >
          {isLoading ? '...loading' : edit ? 'Edit Job' : 'Add Job'}
        </button>
        {isLoading && (
          <p className="opacity-60">{`This action may take up to 60 seconds. You can close this modal at any time.`}</p>
        )}
      </form>
    </div>
  )
}
