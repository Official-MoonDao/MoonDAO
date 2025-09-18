import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount, useReadContract } from 'thirdweb/react'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { daysSinceTimestamp } from '@/lib/utils/timestamp'
import Frame from '../layout/Frame'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import StandardButton from '../layout/StandardButton'
import StandardCard from '../layout/StandardCard'
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
  previewMode?: boolean
}

export default function Job({
  id,
  job,
  jobTableContract,
  refreshJobs,
  editable,
  teamContract,
  showTeam,
  previewMode = false,
}: JobProps) {
  const account = useActiveAccount()

  const [enabledEditJobModal, setEnabledEditJobModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const [teamNFT, setTeamNFT] = useState<any>()

  const currTime = useCurrUnixTime()

  const daysSincePosting = daysSinceTimestamp(job?.timestamp)

  useEffect(() => {
    async function getTeamNFT() {
      const teamNFT = await getNFT({
        contract: teamContract,
        tokenId: BigInt(job.teamId),
      })
      setTeamNFT(teamNFT)
    }
    if (teamContract) getTeamNFT()
  }, [job, teamContract])

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

  if (!isActive) return null

  const jobActions = (
    <div className="flex gap-2 items-center">
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
            onClick={(e) => {
              e.stopPropagation()
              setEnabledEditJobModal(true)
            }}
          >
            {!isDeleting && (
              <PencilIcon className="h-6 w-6 text-light-warm hover:text-light-cool" />
            )}
          </button>
          {isDeleting ? (
            <LoadingSpinner className="scale-[75%]" />
          ) : (
            <button
              id="delete-job-button"
              onClick={async (e) => {
                e.stopPropagation()
                setIsDeleting(true)
                try {
                  if (!account) throw new Error('No account found')
                  const transaction = prepareContractCall({
                    contract: jobTableContract,
                    method: 'deleteFromTable' as string,
                    params: [job.id, job.teamId],
                  })
                  const receipt = await sendAndConfirmTransaction({
                    transaction,
                    account,
                  })
                  if (receipt) {
                    setTimeout(() => {
                      refreshJobs()
                      setIsDeleting(false)
                    }, 25000)
                  }
                } catch (err) {
                  console.log(err)
                  setIsDeleting(false)
                }
              }}
            >
              <TrashIcon className="h-6 w-6 text-light-warm hover:text-light-cool" />
            </button>
          )}
        </div>
      )}
    </div>
  )

  const jobFooter = (
    <>
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
    </>
  )

  return (
    <>
      <StandardCard
        title={job.title}
        headerLink={showTeam && teamNFT ? `/team/${job.teamId}` : undefined}
        headerLinkLabel={
          showTeam && teamNFT ? teamNFT.metadata.name : undefined
        }
        paragraph={job.description}
        footer={jobFooter}
        actions={jobActions}
        fullParagraph
        inline
      />

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
    </>
  )
}
