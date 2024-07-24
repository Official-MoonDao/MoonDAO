import { XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import toast from 'react-hot-toast'
import cleanData from '@/lib/tableland/cleanData'
import { Job } from '../jobs/Job'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type JobData = {
  title: string
  description: string
  contactInfo: string
}

type TeamJobModalProps = {
  teamId: string
  setEnabled: Function
  refreshJobs: Function
  jobTableContract: any
  edit?: boolean
  job?: Job
}

export default function TeamJobModal({
  teamId,
  setEnabled,
  refreshJobs,
  jobTableContract,
  edit,
  job,
}: TeamJobModalProps) {
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
    <Modal id="team-job-modal-backdrop" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-darkest-cool rounded-md"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            jobData.title.trim() === '' ||
            jobData.description.trim() === '' ||
            jobData.contactInfo.trim() === ''
          )
            return toast.error('Please fill out all fields')

          setIsLoading(true)

          const cleanedData = cleanData(jobData)

          try {
            if (edit) {
              await jobTableContract.call('updateTable', [
                job?.id,
                cleanedData.title,
                cleanedData.description,
                teamId,
                cleanedData.contactInfo,
              ])
            } else {
              await jobTableContract?.call('insertIntoTable', [
                cleanedData.title,
                cleanedData.description,
                teamId,
                cleanedData.contactInfo,
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
          <h2 className="font-GoodTimes">
            {edit ? 'Edit a Job' : 'Add a Job'}
          </h2>
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
          placeholder="Application Link"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setJobData({ ...jobData, contactInfo: e.target.value })
          }}
          value={jobData.contactInfo}
        />

        <PrivyWeb3Button
          label={edit ? 'Edit Job' : 'Add Job'}
          type="submit"
          isDisabled={isLoading}
          action={() => {}}
          className="mt-4 w-full gradient-2 rounded-[5vmax]"
        />
        {isLoading && (
          <p className="opacity-60">{`This action may take up to 60 seconds. You can close this modal at any time.`}</p>
        )}
      </form>
    </Modal>
  )
}
