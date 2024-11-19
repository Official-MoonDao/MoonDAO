import { XMarkIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'
import { DEFAULT_CHAIN } from 'const/config'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createSession, destroySession } from '@/lib/iron-session/iron-session'
import cleanData from '@/lib/tableland/cleanData'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { daysFromNowTimestamp } from '@/lib/utils/timestamp'
import { Job } from '../jobs/Job'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type JobData = {
  title: string
  description: string
  contactInfo: string
  metadata: string
  tag: string
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
  const { getAccessToken } = usePrivy()

  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [jobData, setJobData] = useState<JobData>(
    edit
      ? {
          title: job?.title || '',
          description: job?.description || '',
          contactInfo: job?.contactInfo || '',
          metadata: job?.metadata || '',
          tag: job?.tag || '',
        }
      : {
          title: '',
          description: '',
          contactInfo: '',
          metadata: '',
          tag: '',
        }
  )
  const [endTime, setEndTime] = useState(job?.endTime || 0)

  const isValid =
    jobData.title.trim() !== '' &&
    jobData.description.trim() !== '' &&
    jobData.contactInfo.trim() !== ''

  const currTime = useCurrUnixTime()

  useEffect(() => {
    if (
      job?.endTime !== undefined &&
      job.endTime !== 0 &&
      job.endTime < currTime
    ) {
      setIsExpired(true)
    } else {
      setIsExpired(false)
    }
  }, [currTime, job?.endTime])

  return (
    <Modal id="team-job-modal-backdrop" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5 bg-gradient-to-b from-dark-cool to-darkest-cool rounded-[2vmax] h-screen md:h-auto"
        onSubmit={async (e) => {
          e.preventDefault()
          const accessToken = await getAccessToken()
          await createSession(accessToken)
          if (
            jobData.title.trim() === '' ||
            jobData.description.trim() === '' ||
            jobData.contactInfo.trim() === ''
          )
            return toast.error('Please fill out all fields')

          if (endTime === 0 || endTime <= daysFromNowTimestamp(1)) {
            return toast.error('Please set an expiration date')
          }

          setIsLoading(true)

          const cleanedData = cleanData(jobData)

          let tx
          try {
            if (edit) {
              tx = await jobTableContract.call('updateTable', [
                job?.id,
                cleanedData.title,
                cleanedData.description,
                teamId,
                '',
                '',
                endTime,
                currTime,
                cleanedData.contactInfo,
              ])
            } else {
              tx = await jobTableContract?.call('insertIntoTable', [
                cleanedData.title,
                cleanedData.description,
                teamId,
                '',
                '',
                endTime,
                currTime,
                cleanedData.contactInfo,
              ])
            }

            const jobId = parseInt(tx.receipt.logs[0].topics[0], 16).toString()

            console.log(jobId)

            setTimeout(() => {
              refreshJobs()
              setIsLoading(false)
              setEnabled(false)
            }, 25000)
          } catch (err: any) {
            console.log(err)
            setIsLoading(false)
          }
          await destroySession(accessToken)
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
        <div className="w-full flex flex-col gap-2 p-2 mt-2 rounded-t-[20px] rounded-bl-[10px] items-start justify-start bg-darkest-cool">
          <input
            id="job-title-input"
            type="text"
            placeholder="Title"
            className="w-full mt-2 py-2 px-5 border-2 dark:border-0 dark:bg-[#0f152f] rounded-t-[20px] focus:outline-none focus:ring-2 focus:ring-light-warm"
            onChange={(e) => {
              setJobData({ ...jobData, title: e.target.value })
            }}
            value={jobData.title}
          />
          <textarea
            id="job-description-input"
            placeholder="Description"
            className="w-full h-[250px] py-2 px-5 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm focus:outline-none focus:ring-2 focus:ring-light-warm"
            onChange={(e) => {
              setJobData({ ...jobData, description: e.target.value })
            }}
            value={jobData.description}
            style={{ resize: 'none' }}
            maxLength={500}
          />
          <input
            id="job-application-link-input"
            type="text"
            placeholder="Application Link"
            className="w-full py-2 px-5 border-2 rounded-b-[20px] dark:border-0 dark:bg-[#0f152f] focus:outline-none focus:ring-2 focus:ring-light-warm"
            onChange={(e) => {
              setJobData({ ...jobData, contactInfo: e.target.value })
            }}
            value={jobData.contactInfo}
          />
          <div className="w-full flex gap-2 items-center">
            <p>Expiration:</p>
            <input
              id="job-end-time-input"
              className="p-2 rounded-sm text-black"
              type="date"
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              value={
                endTime > 0
                  ? new Date(endTime * 1000).toISOString().split('T')[0]
                  : 0
              }
              onChange={({ target }: any) => {
                const date = new Date(target.value)
                const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
                const adjustedDate = new Date(date.getTime() + timezoneOffset)
                const unixTime = Math.floor(adjustedDate.getTime() / 1000)
                setEndTime(unixTime)
              }}
            />
          </div>
          {job?.endTime && (
            <p id="job-expiration-status" className="mt-4 opacity-60">
              {isExpired
                ? `*This job post expired on ${new Date(
                    job.endTime * 1000
                  ).toLocaleDateString()}`
                : `*This job post will end on ${new Date(
                    job.endTime * 1000
                  ).toLocaleDateString()}`}
            </p>
          )}
        </div>

        <PrivyWeb3Button
          requiredChain={DEFAULT_CHAIN}
          label={edit ? 'Edit Job' : 'Add Job'}
          type="submit"
          isDisabled={isLoading}
          action={() => {}}
          className={`w-full gradient-2 rounded-t0 rounded-b-[2vmax] ${
            !isValid ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        {isLoading && (
          <p className="opacity-60">{`This action may take up to 60 seconds. You can close this modal at any time.`}</p>
        )}
      </form>
    </Modal>
  )
}
