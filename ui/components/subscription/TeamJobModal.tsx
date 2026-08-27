import { ChevronDownIcon } from '@heroicons/react/24/outline'
import TeamABI from 'const/abis/Team.json'
import {
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  TEAM_ADDRESSES,
  DISCORD_CITIZEN_ROLE_ID,
} from 'const/config'
import { ReactNode, useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import sendDiscordMessage from '@/lib/discord/sendDiscordMessage'
import {
  JOB_CATEGORIES,
  JOB_COMMITMENT_TYPES,
  JOB_COMPENSATION_PERIODS,
  JOB_LOCATION_TYPES,
  JobCommitmentType,
  JobCompensationPeriod,
  JobLocationType,
  JobPostingDoc,
  MAX_SUMMARY_CHARS,
  buildJobMetadata,
  locationTypeLabel,
  normalizeJobPostingDoc,
  parseJobMetadata,
  serializeJobMetadata,
} from '@/lib/jobs/jobMetadata'
import { fetchJobPostingDoc, pinJobPostingDoc } from '@/lib/jobs/jobPostingDoc'
import cleanData from '@/lib/tableland/cleanData'
import { waitForRow } from '@/lib/tableland/waitForRow'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useCurrUnixTime from '@/lib/utils/hooks/useCurrUnixTime'
import { daysFromNowTimestamp } from '@/lib/utils/timestamp'
import { Job } from '../jobs/Job'
import Input from '../layout/Input'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type JobFormState = {
  title: string
  tag: string
  description: string
  contactInfo: string
  body: string
  commitmentType: string
  hoursPerWeek: string
  duration: string
  startDate: string
  locationType: string
  region: string
  timezones: string
  level: string
  compMin: string
  compMax: string
  compCurrency: string
  compPeriod: string
  compPaidIn: string
  compNotes: string
  /** Legacy / envelope display string; used when min/max are empty. */
  compDisplay: string
  skills: string
  responsibilities: string
  requirements: string
  niceToHave: string
  successCriteria: string
  whatWeOffer: string
  applicationRequirements: string
  hiringProcess: string
  links: string
}

const EMPTY_FORM: JobFormState = {
  title: '',
  tag: '',
  description: '',
  contactInfo: '',
  body: '',
  commitmentType: '',
  hoursPerWeek: '',
  duration: '',
  startDate: '',
  locationType: '',
  region: '',
  timezones: '',
  level: '',
  compMin: '',
  compMax: '',
  compCurrency: 'USD',
  compPeriod: 'month',
  compPaidIn: '',
  compNotes: '',
  compDisplay: '',
  skills: '',
  responsibilities: '',
  requirements: '',
  niceToHave: '',
  successCriteria: '',
  whatWeOffer: '',
  applicationRequirements: '',
  hiringProcess: '',
  links: '',
}

type TeamJobModalProps = {
  teamId: string
  setEnabled: (enabled: boolean) => void
  refreshJobs: Function
  jobTableContract: any
  edit?: boolean
  job?: Job
}

function toLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function fromLines(items?: string[]): string {
  return items?.length ? items.join('\n') : ''
}

function toNumber(value: string): number | undefined {
  const parsed = Number(value.replace(/,/g, ''))
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined
}

function dateToUnix(value: string): number | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return undefined
  return Math.floor(date.getTime() / 1000)
}

function unixToDate(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return ''
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `Label | detail` per line, so multi-part lists stay editable as plain text. */
function toPairs(value: string, keys: [string, string]) {
  return toLines(value).map((line) => {
    const [first, ...rest] = line.split('|')
    return { [keys[0]]: first.trim(), [keys[1]]: rest.join('|').trim() || undefined } as any
  })
}

function fromPairs(items: any[] | undefined, keys: [string, string]): string {
  if (!items?.length) return ''
  return items
    .map((item) => (item[keys[1]] ? `${item[keys[0]]} | ${item[keys[1]]}` : item[keys[0]]))
    .join('\n')
}

/** Inverse of `formatLocation`: region from an envelope card string. */
function regionFromEnvelope(location?: string, locationType?: JobLocationType): string {
  if (!location) return ''
  if (!locationType) return location
  const label = locationTypeLabel(locationType)
  if (!label) return location
  if (location === label) return ''
  const prefix = `${label} · `
  return location.startsWith(prefix) ? location.slice(prefix.length) : location
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Not specified',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <label htmlFor={id} className="w-full flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 rounded-sm bg-black/20 border border-white/10 text-white"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="w-full flex flex-col gap-1">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left"
      >
        <span>
          <span className="text-white font-semibold text-sm">{title}</span>
          {subtitle && <span className="block text-xs text-slate-400 mt-0.5">{subtitle}</span>}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="p-3 pt-0 flex flex-col gap-3">{children}</div>}
    </div>
  )
}

function ListField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field id={id} label={label} hint={hint || 'One per line.'}>
      <textarea
        id={id}
        className="w-full p-2 rounded-sm bg-black/20 border border-white/10 text-white text-sm"
        rows={4}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
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
  const [isLoadingPosting, setIsLoadingPosting] = useState(false)
  const [postingLoadFailed, setPostingLoadFailed] = useState(false)

  const existingMetadata = parseJobMetadata(job?.metadata)

  const [form, setForm] = useState<JobFormState>(
    edit
      ? {
          ...EMPTY_FORM,
          title: job?.title || '',
          tag: job?.tag || '',
          description: job?.description || '',
          contactInfo: job?.contactInfo || '',
          level: existingMetadata.level || '',
          commitmentType: existingMetadata.commitmentType || '',
          hoursPerWeek: existingMetadata.hoursPerWeek ? String(existingMetadata.hoursPerWeek) : '',
          locationType: existingMetadata.locationType || '',
          region: regionFromEnvelope(existingMetadata.location, existingMetadata.locationType),
          compDisplay: existingMetadata.compensation || '',
          skills: (existingMetadata.skills || []).join(', '),
        }
      : EMPTY_FORM
  )
  const [endTime, setEndTime] = useState(job?.endTime || 0)
  const [applicationDeadline, setApplicationDeadline] = useState(
    unixToDate(existingMetadata.deadline)
  )

  const isValid =
    form.title.trim() !== '' && form.description.trim() !== '' && form.contactInfo.trim() !== ''

  const currTime = useCurrUnixTime()

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI,
  })

  const update = (patch: Partial<JobFormState>) => setForm((prev) => ({ ...prev, ...patch }))

  // Rehydrate the long-form posting so an edit doesn't silently drop it.
  useEffect(() => {
    if (!edit || !existingMetadata.cid) return
    let cancelled = false
    setIsLoadingPosting(true)
    setPostingLoadFailed(false)
    fetchJobPostingDoc(existingMetadata.cid)
      .then((doc) => {
        if (cancelled) return
        if (!doc) {
          setPostingLoadFailed(true)
          return
        }
        setForm((prev) => ({
          ...prev,
          body: doc.body || prev.body,
          responsibilities: fromLines(doc.responsibilities) || prev.responsibilities,
          requirements: fromLines(doc.requirements) || prev.requirements,
          niceToHave: fromLines(doc.niceToHave) || prev.niceToHave,
          successCriteria: fromLines(doc.successCriteria) || prev.successCriteria,
          whatWeOffer: fromLines(doc.whatWeOffer) || prev.whatWeOffer,
          applicationRequirements:
            fromLines(doc.applicationRequirements) || prev.applicationRequirements,
          hiringProcess: fromPairs(doc.hiringProcess, ['label', 'detail']) || prev.hiringProcess,
          links: fromPairs(doc.links, ['label', 'url']) || prev.links,
          skills: doc.skills?.join(', ') || prev.skills,
          level: doc.level || prev.level,
          commitmentType: doc.commitment?.type || prev.commitmentType,
          hoursPerWeek: doc.commitment?.hoursPerWeek
            ? String(doc.commitment.hoursPerWeek)
            : prev.hoursPerWeek,
          duration: doc.commitment?.duration || prev.duration,
          startDate: doc.commitment?.startDate || prev.startDate,
          locationType: doc.location?.type || prev.locationType,
          region: doc.location?.region || prev.region,
          timezones: doc.location?.timezones || prev.timezones,
          compMin: doc.compensation?.min ? String(doc.compensation.min) : prev.compMin,
          compMax: doc.compensation?.max ? String(doc.compensation.max) : prev.compMax,
          compCurrency: doc.compensation?.currency || prev.compCurrency,
          compPeriod: doc.compensation?.period || prev.compPeriod,
          compPaidIn: doc.compensation?.paidIn || prev.compPaidIn,
          compNotes: doc.compensation?.notes || prev.compNotes,
          compDisplay: doc.compensation?.display || prev.compDisplay,
        }))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPosting(false)
      })
    return () => {
      cancelled = true
    }
  }, [edit, existingMetadata.cid])

  useEffect(() => {
    if (job?.endTime !== undefined && job.endTime !== 0 && job.endTime < currTime) {
      setIsExpired(true)
    } else {
      setIsExpired(false)
    }
  }, [currTime, job?.endTime])

  function buildPostingDoc(expiry: number): JobPostingDoc | null {
    const deadline = dateToUnix(applicationDeadline) ?? (expiry > 0 ? expiry : undefined)

    return normalizeJobPostingDoc({
      body: form.body,
      responsibilities: toLines(form.responsibilities),
      requirements: toLines(form.requirements),
      niceToHave: toLines(form.niceToHave),
      successCriteria: toLines(form.successCriteria),
      whatWeOffer: toLines(form.whatWeOffer),
      applicationRequirements: toLines(form.applicationRequirements),
      hiringProcess: toPairs(form.hiringProcess, ['label', 'detail']),
      links: toPairs(form.links, ['label', 'url']),
      skills: form.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      level: form.level,
      commitment: {
        type: (form.commitmentType || undefined) as JobCommitmentType | undefined,
        hoursPerWeek: toNumber(form.hoursPerWeek),
        duration: form.duration,
        startDate: form.startDate,
      },
      location: {
        type: (form.locationType || undefined) as JobLocationType | undefined,
        region: form.region,
        timezones: form.timezones,
      },
      compensation: {
        min: toNumber(form.compMin),
        max: toNumber(form.compMax),
        currency: form.compCurrency,
        period: (form.compPeriod || undefined) as JobCompensationPeriod | undefined,
        paidIn: form.compPaidIn,
        notes: form.compNotes,
        display:
          toNumber(form.compMin) === undefined && toNumber(form.compMax) === undefined
            ? form.compDisplay
            : undefined,
      },
      applicationDeadline: deadline,
    })
  }

  async function buildMetadataColumn(expiry: number): Promise<string> {
    const doc = buildPostingDoc(expiry)
    if (!doc) return ''

    let cid: string | undefined
    try {
      cid = await pinJobPostingDoc(doc, form.title)
    } catch (error) {
      console.error('Failed to pin job posting document:', error)
      // On edit the metadata column already points at a stored document. Writing
      // without that CID orphans the live posting; abort so the author can retry.
      if (edit) {
        throw new Error(
          'Could not save the full description. Please try again so the existing posting is not overwritten.'
        )
      }
      toast.error('Could not save the full description. Posting the summary and key details only.')
    }

    return serializeJobMetadata(buildJobMetadata(doc, cid))
  }

  /** `JobInserted(uint256 indexed id, uint256 indexed teamId)` from the job table contract. */
  function readInsertedJobId(receipt: any): string | undefined {
    const log = receipt?.logs?.find(
      (entry: any) =>
        entry?.address?.toLowerCase() === jobTableContract?.address?.toLowerCase() &&
        entry?.topics?.length === 3
    )
    if (!log) return undefined
    return BigInt(log.topics[1]).toString()
  }

  async function announce(jobId: string | undefined, jobTeamId: string) {
    try {
      const team = await getNFT({ contract: teamContract, tokenId: BigInt(jobTeamId) })
      const teamName = team?.metadata.name as string
      const link = jobId ? `${DEPLOYED_ORIGIN}/jobs/${jobId}` : `${DEPLOYED_ORIGIN}/jobs`
      sendDiscordMessage(
        'networkNotifications',
        `## [**${teamName}** has ${
          edit ? 'updated a' : 'posted a new'
        } job](${link}) <@&${DISCORD_CITIZEN_ROLE_ID}>`
      )
    } catch (error) {
      console.error('Failed to send job Discord notification:', error)
    }
  }

  async function waitForJobRow(jobId: string | undefined, writtenAt: number) {
    try {
      const tableName = await readContract({
        contract: jobTableContract,
        method: 'getTableName' as string,
        params: [],
      })
      const id = jobId ?? String(job?.id)
      await waitForRow({
        statement: `SELECT * FROM ${tableName} WHERE id = ${id} AND timestamp = ${writtenAt}`,
        cacheBusting: true,
      })
    } catch (error) {
      console.error('Timed out waiting for the job row to appear:', error)
    }
  }

  return (
    <Modal
      id="team-job-modal-backdrop"
      setEnabled={setEnabled}
      title={edit ? 'Edit Job' : 'Create Job'}
      size="lg"
    >
      <form
        className="w-full flex flex-col gap-2 items-start justify-start"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!isValid) return toast.error('Please fill out all required fields.')

          if (endTime === 0 || endTime < daysFromNowTimestamp(1)) {
            return toast.error('Please set an expiration date.')
          }

          // Saving before the stored posting is in the form would replace the
          // long-form description with whatever the fields happen to hold.
          if (isLoadingPosting) {
            return toast.error('Still loading the saved description. Try again in a moment.')
          }
          if (postingLoadFailed) {
            return toast.error(
              'The saved description could not be loaded, so saving now would erase it. Please reopen this form and try again.'
            )
          }

          if (!account) return

          setIsLoading(true)

          try {
            const metadata = await buildMetadataColumn(endTime)
            const cleanedData = cleanData({
              title: form.title,
              description: form.description,
              contactInfo: form.contactInfo,
              tag: form.tag,
              metadata,
            })

            //Check if the contact info is an email and append mailto: if needed
            const formattedContactInfo =
              cleanedData.contactInfo.includes('@') &&
              !cleanedData.contactInfo.startsWith('mailto:')
                ? `mailto:${cleanedData.contactInfo}`
                : cleanedData.contactInfo

            const writtenAt = currTime

            const transaction = edit
              ? prepareContractCall({
                  contract: jobTableContract,
                  method: 'updateTable' as string,
                  params: [
                    job?.id,
                    cleanedData.title,
                    cleanedData.description,
                    teamId,
                    cleanedData.tag,
                    cleanedData.metadata,
                    endTime,
                    writtenAt,
                    formattedContactInfo,
                  ],
                })
              : prepareContractCall({
                  contract: jobTableContract,
                  method: 'insertIntoTable' as string,
                  params: [
                    cleanedData.title,
                    cleanedData.description,
                    teamId,
                    cleanedData.tag,
                    cleanedData.metadata,
                    endTime,
                    writtenAt,
                    formattedContactInfo,
                  ],
                })

            const receipt: any = await sendAndConfirmTransaction({ transaction, account })

            const jobId = edit ? String(job?.id) : readInsertedJobId(receipt)
            await announce(jobId, teamId)
            await waitForJobRow(jobId, writtenAt)

            refreshJobs()
            setIsLoading(false)
            setEnabled(false)
          } catch (err: any) {
            console.log(err)
            toast.error(err?.message || 'Something went wrong saving this job.')
            setIsLoading(false)
          }
        }}
      >
        <div className="w-full flex flex-col gap-3 p-2 mt-2 rounded-t-[20px] rounded-bl-[10px] items-start justify-start bg-darkest-cool">
          <Input
            id="job-title-input"
            type="text"
            placeholder="Title"
            variant="dark"
            className="w-full mt-2 text-white"
            maxWidth="max-w-full"
            onChange={(e) => update({ title: e.target.value })}
            value={form.title}
            maxLength={100}
            formatNumbers={false}
          />

          <Select
            id="job-category-input"
            label="Category"
            value={form.tag}
            onChange={(value) => update({ tag: value })}
            options={JOB_CATEGORIES.map((category) => ({ value: category, label: category }))}
          />

          <Field
            id="job-description-input"
            label="Short summary"
            hint={`Shown on the jobs board, in link previews and in the Discord announcement. ${MAX_SUMMARY_CHARS} characters.`}
          >
            <textarea
              id="job-description-input"
              placeholder="One or two sentences that make a qualified candidate open the role."
              className="w-full p-2 rounded-sm bg-black/20 border border-white/10 text-white"
              rows={3}
              value={form.description}
              maxLength={MAX_SUMMARY_CHARS}
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>

          <Field
            id="job-body-input"
            label="Full description"
            hint="Markdown supported: headings, lists, links and tables. Paste the public description only — not the structured-fields table; those already have their own inputs above and below."
          >
            <textarea
              id="job-body-input"
              placeholder={'## The role\n\nWhat this person owns, why the role exists...'}
              className="w-full p-2 rounded-sm bg-black/20 border border-white/10 text-white font-mono text-sm"
              rows={12}
              value={form.body}
              onChange={(e) => update({ body: e.target.value })}
            />
          </Field>

          <Input
            id="job-application-link-input"
            type="text"
            placeholder="Application Link"
            variant="dark"
            className="w-full text-white"
            maxWidth="max-w-full"
            onChange={(e) => update({ contactInfo: e.target.value })}
            value={form.contactInfo}
            maxLength={500}
            formatNumbers={false}
          />

          <Section
            title="Role details"
            subtitle="Compensation, commitment, location and seniority — shown as quick facts on the role page and used as board filters."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                id="job-commitment-input"
                label="Commitment"
                value={form.commitmentType}
                onChange={(value) => update({ commitmentType: value })}
                options={JOB_COMMITMENT_TYPES}
              />
              <Field id="job-hours-input" label="Hours per week">
                <Input
                  id="job-hours-input"
                  type="text"
                  placeholder="10"
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.hoursPerWeek}
                  onChange={(e) => update({ hoursPerWeek: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Field id="job-duration-input" label="Duration">
                <Input
                  id="job-duration-input"
                  type="text"
                  placeholder="Ongoing, 6 months, ..."
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.duration}
                  onChange={(e) => update({ duration: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Field id="job-start-date-input" label="Start date">
                <Input
                  id="job-start-date-input"
                  type="text"
                  placeholder="ASAP, Q1, ..."
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.startDate}
                  onChange={(e) => update({ startDate: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Select
                id="job-location-type-input"
                label="Location type"
                value={form.locationType}
                onChange={(value) => update({ locationType: value })}
                options={JOB_LOCATION_TYPES}
              />
              <Field id="job-region-input" label="Region">
                <Input
                  id="job-region-input"
                  type="text"
                  placeholder="Worldwide, Berlin, ..."
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.region}
                  onChange={(e) => update({ region: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Field id="job-timezones-input" label="Timezone expectations">
                <Input
                  id="job-timezones-input"
                  type="text"
                  placeholder="Overlap with US/EU windows"
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.timezones}
                  onChange={(e) => update({ timezones: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Field id="job-level-input" label="Level">
                <Input
                  id="job-level-input"
                  type="text"
                  placeholder="Junior, Mid, Senior, ..."
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.level}
                  onChange={(e) => update({ level: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Field id="job-comp-min-input" label="Compensation from">
                <Input
                  id="job-comp-min-input"
                  type="text"
                  placeholder="3000"
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.compMin}
                  onChange={(e) => update({ compMin: e.target.value })}
                />
              </Field>
              <Field id="job-comp-max-input" label="Compensation to">
                <Input
                  id="job-comp-max-input"
                  type="text"
                  placeholder="4500"
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.compMax}
                  onChange={(e) => update({ compMax: e.target.value })}
                />
              </Field>
              <Select
                id="job-comp-period-input"
                label="Compensation period"
                value={form.compPeriod}
                onChange={(value) => update({ compPeriod: value })}
                options={JOB_COMPENSATION_PERIODS}
                placeholder="Choose a period"
              />
              <Field id="job-comp-paid-in-input" label="Paid in">
                <Input
                  id="job-comp-paid-in-input"
                  type="text"
                  placeholder="fiat and/or $MOONEY"
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.compPaidIn}
                  onChange={(e) => update({ compPaidIn: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
              <Field
                id="job-comp-display-input"
                label="Compensation (free text)"
                hint="Used only when the range above is empty. Clear it to remove compensation."
              >
                <Input
                  id="job-comp-display-input"
                  type="text"
                  placeholder="Bounty, negotiable"
                  variant="dark"
                  className="w-full text-white"
                  maxWidth="max-w-full"
                  value={form.compDisplay}
                  onChange={(e) => update({ compDisplay: e.target.value })}
                  formatNumbers={false}
                />
              </Field>
            </div>
            <ListField
              id="job-comp-notes-input"
              label="Compensation notes"
              hint="How the number is decided, review cadence, budget cycle."
              value={form.compNotes}
              onChange={(value) => update({ compNotes: value })}
            />
            <Field
              id="job-skills-input"
              label="Skills"
              hint="Comma separated. Used for search and board filters."
            >
              <Input
                id="job-skills-input"
                type="text"
                placeholder="X growth, short-form video, analytics"
                variant="dark"
                className="w-full text-white"
                maxWidth="max-w-full"
                value={form.skills}
                onChange={(e) => update({ skills: e.target.value })}
                formatNumbers={false}
              />
            </Field>
          </Section>

          <Section
            title="Structured sections"
            subtitle="Scannable lists a candidate can self-assess against. All optional."
          >
            <ListField
              id="job-responsibilities-input"
              label="What they'll own"
              value={form.responsibilities}
              onChange={(value) => update({ responsibilities: value })}
            />
            <ListField
              id="job-requirements-input"
              label="Requirements"
              value={form.requirements}
              onChange={(value) => update({ requirements: value })}
            />
            <ListField
              id="job-nice-to-have-input"
              label="Nice to have"
              value={form.niceToHave}
              onChange={(value) => update({ niceToHave: value })}
            />
            <ListField
              id="job-success-input"
              label="What success looks like"
              value={form.successCriteria}
              onChange={(value) => update({ successCriteria: value })}
            />
            <ListField
              id="job-offer-input"
              label="What we give you"
              value={form.whatWeOffer}
              onChange={(value) => update({ whatWeOffer: value })}
            />
            <ListField
              id="job-application-requirements-input"
              label="What to include in an application"
              value={form.applicationRequirements}
              onChange={(value) => update({ applicationRequirements: value })}
            />
            <ListField
              id="job-hiring-process-input"
              label="Hiring process"
              hint="One step per line, as `Step | what happens`."
              placeholder={
                'Interview | 30 minutes with the team\nPaid trial | One thread, one carousel'
              }
              value={form.hiringProcess}
              onChange={(value) => update({ hiringProcess: value })}
            />
            <ListField
              id="job-links-input"
              label="Worth reading before applying"
              hint="One link per line, as `Label | https://...`."
              placeholder={'Treasury | https://moondao.com/analytics'}
              value={form.links}
              onChange={(value) => update({ links: value })}
            />
          </Section>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="job-end-time-input" label="Listing expires">
              <input
                id="job-end-time-input"
                className="p-2 rounded-sm text-black"
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                value={unixToDate(endTime)}
                onChange={({ target }: any) => {
                  setEndTime(dateToUnix(target.value) || 0)
                }}
              />
            </Field>
            <Field
              id="job-application-deadline-input"
              label="Applications close"
              hint="Defaults to the expiry date."
            >
              <input
                id="job-application-deadline-input"
                className="p-2 rounded-sm text-black"
                type="date"
                value={applicationDeadline}
                onChange={({ target }: any) => setApplicationDeadline(target.value)}
              />
            </Field>
          </div>

          {job?.endTime && (
            <p id="job-expiration-status" className="mt-4 opacity-60">
              {isExpired
                ? `*This job post expired on ${new Date(job.endTime * 1000).toLocaleDateString()}`
                : `*This job post will end on ${new Date(job.endTime * 1000).toLocaleDateString()}`}
            </p>
          )}

          {isLoadingPosting && (
            <p className="text-xs text-slate-400">Loading the saved description…</p>
          )}

          {postingLoadFailed && (
            <p id="job-posting-load-error" className="text-xs text-red-400">
              {`The saved description couldn't be loaded from IPFS. Saving now would erase it — please close and reopen this form.`}
            </p>
          )}
        </div>

        <PrivyWeb3Button
          requiredChain={DEFAULT_CHAIN_V5}
          label={edit ? 'Edit Job' : 'Add Job'}
          type="submit"
          isDisabled={
            !teamContract || !jobTableContract || isLoading || isLoadingPosting || postingLoadFailed
          }
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
