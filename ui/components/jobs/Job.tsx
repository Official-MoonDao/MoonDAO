import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import {
  formatDeadlineCountdown,
  getApplicationDeadline,
  getJobHref,
  parseJobMetadata,
} from '@/lib/jobs/jobMetadata'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { daysSinceTimestamp } from '@/lib/utils/timestamp'
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
  /** JSON string or already-parsed object — Tableland returns TEXT JSON as either. */
  metadata: string | Record<string, unknown>
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-1 text-xs bg-white/5 text-slate-300 rounded-md border border-white/10">
      {children}
    </span>
  )
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
  const metadata = parseJobMetadata(job?.metadata)
  const deadline = getApplicationDeadline(metadata, job?.endTime)
  const countdown = formatDeadlineCountdown(deadline, currTime)
  const href = getJobHref(job)

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

    if (currTime > job.endTime && job.endTime !== 0 && job.endTime !== undefined) {
      setIsExpired(true)
    } else {
      setIsExpired(false)
    }
  }, [currTime, job.endTime, editable])

  if (!isActive) return null

  const jobActions = (
    <div className="flex gap-2 items-center">
      {job.contactInfo && !previewMode && (
        <StandardButton
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105"
          onClick={() => {
            window.open(job.contactInfo)
          }}
        >
          Apply
        </StandardButton>
      )}
      {editable && (
        <div className="flex gap-2">
          <button
            id="edit-job-button"
            className="p-2 bg-slate-600/30 hover:bg-slate-500/50 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setEnabledEditJobModal(true)
            }}
          >
            {!isDeleting && <PencilIcon className="h-4 w-4 text-slate-300 hover:text-white" />}
          </button>
          {isDeleting ? (
            <div className="p-2">
              <LoadingSpinner className="scale-75" />
            </div>
          ) : (
            <button
              id="delete-job-button"
              className="p-2 bg-slate-600/30 hover:bg-red-500/50 rounded-lg transition-colors"
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
              <TrashIcon className="h-4 w-4 text-slate-300 hover:text-red-300" />
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      <div
        id={id}
        className="group bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-xl border border-slate-600/30 p-5 flex flex-col h-full hover:border-slate-500/50 transition-all duration-200"
      >
        {showTeam && teamNFT && (
          <Link
            href={`/team/${job.teamId}`}
            className="text-xs text-blue-400 hover:text-blue-300 mb-1 block w-fit"
          >
            {teamNFT.metadata.name}
          </Link>
        )}

        <Link href={href} className="flex-1 flex flex-col">
          <h3 className="font-GoodTimes text-white text-base leading-tight group-hover:text-blue-200 transition-colors">
            {job.title}
          </h3>

          <div className="flex flex-wrap gap-2 mt-2">
            {job.tag && (
              <span className="inline-block px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30">
                {job.tag}
              </span>
            )}
            {metadata.commitment && <Chip>{metadata.commitment}</Chip>}
            {metadata.location && <Chip>{metadata.location}</Chip>}
            {metadata.compensation && <Chip>{metadata.compensation}</Chip>}
          </div>

          <p className="mt-3 flex-1 text-sm text-slate-300 leading-relaxed line-clamp-3">
            {job.description}
          </p>

          <span className="text-xs text-blue-400 group-hover:text-blue-300 mt-3 transition-colors">
            View role and apply →
          </span>
        </Link>

        <div className="pt-3 mt-4 border-t border-slate-600/30">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <span>
                {daysSincePosting === 0
                  ? 'Posted today'
                  : daysSincePosting === 1
                    ? '1 day ago'
                    : `${daysSincePosting} days ago`}
              </span>
              {countdown && !isExpired && (
                <span className="ml-2 text-slate-400">· {countdown}</span>
              )}
            </div>
            {jobActions}
          </div>
          {editable && isExpired && (
            <p className="text-xs text-red-400 mt-2">This job post has expired</p>
          )}
        </div>
      </div>

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
