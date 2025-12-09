import { XMarkIcon } from '@heroicons/react/24/outline'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  TEAM_ADDRESSES,
  DISCORD_CITIZEN_ROLE_ID,
} from 'const/config'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import cleanData from '@/lib/tableland/cleanData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { bytesOfString } from '@/lib/utils/strings'
import { daysFromNowTimestamp } from '@/lib/utils/timestamp'
import { Job } from '../jobs/Job'
import Input from '../layout/Input'
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
  const account = useActiveAccount()
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
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

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
  })

  useEffect(() => {
    if (job?.endTime !== undefined && job.endTime !== 0 && job.endTime < currTime) {
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
          if (
            jobData.title.trim() === '' ||
            jobData.description.trim() === '' ||
            jobData.contactInfo.trim() === ''
          )
            return toast.error('Please fill out all fields.')

          if (endTime === 0 || endTime < daysFromNowTimestamp(1)) {
            return toast.error('Please set an expiration date.')
          }

          setIsLoading(true)

          const cleanedData = cleanData(jobData)

          //Check if the contact info is an email and append mailto: if needed
          let formattedContactInfo
          if (
            cleanedData.contactInfo.includes('@') &&
            !cleanedData.contactInfo.startsWith('mailto:')
          ) {
            formattedContactInfo = `mailto:${cleanedData.contactInfo}`
          } else {
            formattedContactInfo = cleanedData.contactInfo
          }

          if (!account) return

          let transaction
          try {
            if (edit) {
              transaction = prepareContractCall({
                contract: jobTableContract,
                method: 'updateTable' as string,
                params: [
                  job?.id,
                  cleanedData.title,
                  cleanedData.description,
                  teamId,
                  '',
                  '',
                  endTime,
                  currTime,
                  formattedContactInfo,
                ],
              })
            } else {
              transaction = prepareContractCall({
                contract: jobTableContract,
                method: 'insertIntoTable' as string,
                params: [
                  cleanedData.title,
                  cleanedData.description,
                  teamId,
                  '',
                  '',
                  endTime,
                  currTime,
                  formattedContactInfo,
                ],
              })
            }

            const receipt: any = await sendAndConfirmTransaction({
              transaction,
              account,
            })

            //Get job id and team id from receipt and send discord notification
            const jobId = parseInt(receipt.logs[1].topics[1], 16).toString()
            const jobTeamId = parseInt(receipt.logs[1].topics[2], 16).toString()
            const team = await getNFT({
              contract: teamContract,
              tokenId: BigInt(jobTeamId),
            })
            const teamName = team?.metadata.name as string
            sendDiscordMessage(
              'networkNotifications',
              `## [**${teamName}** has ${
                edit ? 'updated a' : 'posted a new'
              } job](${DEPLOYED_ORIGIN}/team/${generatePrettyLink(
                teamName
              )}?job=${jobId}&_timestamp=123456789) <@&${DISCORD_CITIZEN_ROLE_ID}>`
            )

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
          <h2 className="font-GoodTimes">{edit ? 'Edit a Job' : 'Add a Job'}</h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="w-full flex flex-col gap-2 p-2 mt-2 rounded-t-[20px] rounded-bl-[10px] items-start justify-start bg-darkest-cool">
          <Input
            id="job-title-input"
            type="text"
            placeholder="Title"
            variant="dark"
            className="w-full mt-2 text-white"
            onChange={(e) => {
              setJobData({ ...jobData, title: e.target.value })
            }}
            value={jobData.title}
            maxLength={100}
            formatNumbers={false}
          />
          <Input
            id="job-description-input"
            type="textarea"
            placeholder="Description"
            variant="dark"
            className="w-full h-[250px] text-white"
            onChange={(e) => {
              setJobData({ ...jobData, description: e.target.value })
            }}
            value={jobData.description}
            rows={10}
            maxLength={
              bytesOfString(jobData.description) >= 1024 ? jobData.description.length : 1024
            }
            formatNumbers={false}
          />
          <Input
            id="job-application-link-input"
            type="text"
            placeholder="Application Link"
            variant="dark"
            className="w-full text-white"
            onChange={(e) => {
              setJobData({ ...jobData, contactInfo: e.target.value })
            }}
            value={jobData.contactInfo}
            maxLength={500}
            formatNumbers={false}
          />
          <div className="w-full flex gap-2 items-center">
            <p>Expiration:</p>
            <input
              id="job-end-time-input"
              className="p-2 rounded-sm text-black"
              type="date"
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              value={endTime > 0 ? new Date(endTime * 1000).toISOString().split('T')[0] : 0}
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
                ? `*This job post expired on ${new Date(job.endTime * 1000).toLocaleDateString()}`
                : `*This job post will end on ${new Date(job.endTime * 1000).toLocaleDateString()}`}
            </p>
          )}
        </div>

        <PrivyWeb3Button
          requiredChain={DEFAULT_CHAIN_V5}
          label={edit ? 'Edit Job' : 'Add Job'}
          type="submit"
          isDisabled={!teamContract || !jobTableContract || isLoading}
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
