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
import Card from '../layout/Card'
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
            {!isDeleting && (
              <PencilIcon className="h-4 w-4 text-slate-300 hover:text-white" />
            )}
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

  if (!isActive) return null

  return (
    <>
      <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-xl border border-slate-600/30 p-5 flex flex-col h-full hover:border-slate-500/50 transition-all duration-200">
        {/* Header with title and team link */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {showTeam && teamNFT && (
              <Link
                href={`/team/${job.teamId}`}
                className="text-xs text-blue-400 hover:text-blue-300 mb-1 block"
                onClick={(e) => e.stopPropagation()}
              >
                {teamNFT.metadata.name}
              </Link>
            )}
            <h3 className="font-GoodTimes text-white text-base leading-tight">
              {job.title}
            </h3>
            {job.tag && (
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-md border border-blue-500/30">
                {job.tag}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="flex-1 mb-4">
          <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed">
            {job.description}
          </p>
        </div>

        {/* Metadata (compensation, location) */}
        {job.metadata && (
          <div className="mb-4 space-y-1">
            {(() => {
              try {
                const metadata = JSON.parse(job.metadata)
                return (
                  <>
                    {metadata.compensation && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold">💰</span>
                        <span>{metadata.compensation}</span>
                      </div>
                    )}
                    {metadata.location && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold">📍</span>
                        <span>{metadata.location}</span>
                      </div>
                    )}
                  </>
                )
              } catch {
                return null
              }
            })()}
          </div>
        )}

        {/* Footer with actions and timestamp */}
        <div className="pt-3 border-t border-slate-600/30">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {daysSincePosting === 0
                ? 'Posted today'
                : daysSincePosting === 1
                ? '1 day ago'
                : `${daysSincePosting} days ago`}
            </div>
            {jobActions}
          </div>
          {editable && isExpired && (
            <p className="text-xs text-red-400 mt-2">
              This job post has expired
            </p>
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
