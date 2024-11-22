import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useNFT } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { daysSinceTimestamp } from '@/lib/utils/timestamp'
import Frame from '../layout/Frame'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import StandardButton from '../layout/StandardButton'
import TeamJobModal from '../subscription/TeamJobModal'

export type Job = {
  id: number
  teamId: number
  title: string
  description: string
  endTime: number
  timestamp: number
  tag: string
  metadata: string
  contactInfo: string
}

type JobProps = {
  id?: string
  job: Job
  jobTableContract?: any
  refreshJobs?: any
  editable?: boolean
  teamContract?: any
  showTeam?: boolean
}

export default function Job({
  id,
  job,
  jobTableContract,
  refreshJobs,
  editable,
  teamContract,
  showTeam,
}: JobProps) {
  const [enabledEditJobModal, setEnabledEditJobModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const { data: teamNft } = useNFT(teamContract, job.teamId)

  const currTime = useCurrUnixTime()

  const daysSincePosting = daysSinceTimestamp(job?.timestamp)

  useEffect(() => {
    if (currTime <= job.endTime || job.endTime === 0 || editable) {
      setIsActive(true)
    } else {
      setIsActive(false)
    }

    if (
      currTime > job.endTime &&
      job.endTime !== 0 &&
      job.endTime !== undefined
    ) {
      setIsExpired(true)
    } else {
      setIsExpired(false)
    }
  }, [currTime, job.endTime, editable])

  return (
    <>
      {isActive && (
        <div
          id={id}
          className={`flex flex-col justify-between bg-dark-cool rounded-md lg:w-[500px]`}
        >
          <Frame>
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                {showTeam && teamNft && (
                  <Link
                    href={`/team/${job.teamId}`}
                    className="font-bold text-light-warm"
                  >
                    {teamNft.metadata.name}
                  </Link>
                )}
                <p className="font-bold font-GoodTimes pb-2">{job.title}</p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex flex-col lg:flex-row pb-5 items-center gap-2 lg:gap-4">
                  {job.contactInfo && (
                    <StandardButton
                      className="gradient-2 rounded-[5vmax] rounded-bl-[20px]"
                      onClick={() => {
                        window.open(job.contactInfo)
                      }}
                    >
                      Apply
                    </StandardButton>
                  )}
                  {editable && (
                    <div className="flex gap-4">
                      <button
                        id="edit-job-button"
                        onClick={() => setEnabledEditJobModal(true)}
                      >
                        {!isDeleting && (
                          <PencilIcon className="h-6 w-6 text-light-warm" />
                        )}
                      </button>
                      {isDeleting ? (
                        <LoadingSpinner className="scale-[75%]" />
                      ) : (
                        <button
                          id="delete-job-button"
                          onClick={async () => {
                            setIsDeleting(true)
                            try {
                              await jobTableContract.call('deleteFromTable', [
                                job.id,
                                job.teamId,
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
                          <TrashIcon className="h-6 w-6 text-light-warm" />
                        </button>
                      )}
                      {enabledEditJobModal && (
                        <TeamJobModal
                          teamId={job.teamId as any}
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
            {editable && isExpired && (
              <p id="job-expired-status" className="mt-4 opacity-60">
                {`*This job post has expired and is no longer available.`}
              </p>
            )}
            {!isExpired && job.endTime != 0 && (
              <p id="job-posted-status" className="mt-4 opacity-60">
                {`This job was posted ${
                  daysSincePosting === 0
                    ? `today`
                    : daysSincePosting === 1
                    ? `${daysSincePosting} day ago`
                    : `${daysSincePosting} days ago`
                }`}
              </p>
            )}
          </Frame>
        </div>
      )}
    </>
  )
}
