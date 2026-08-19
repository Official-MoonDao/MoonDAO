import {
  AcademicCapIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ClockIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { ReactNode } from 'react'
import {
  JobMetadataEnvelope,
  JobPostingDoc,
  commitmentTypeLabel,
  formatCompensation,
  formatDate,
  formatLocation,
  locationTypeLabel,
} from '@/lib/jobs/jobMetadata'

export type JobFact = {
  label: string
  value: string
  icon: ReactNode
}

const iconClass = 'h-5 w-5 text-blue-300 flex-shrink-0'

/**
 * The facts a candidate scans before reading a word of the posting. Built from
 * the IPFS document when present, falling back to the on-chain envelope so a
 * job saved before the richer form still shows what it knows.
 */
export function buildJobFacts({
  envelope,
  doc,
  deadline,
}: {
  envelope: JobMetadataEnvelope
  doc?: JobPostingDoc | null
  deadline?: number
}): JobFact[] {
  const facts: JobFact[] = []

  const compensation = formatCompensation(doc?.compensation) || envelope.compensation
  if (compensation) {
    facts.push({
      label: 'Compensation',
      value: doc?.compensation?.paidIn
        ? `${compensation} · ${doc.compensation.paidIn}`
        : compensation,
      icon: <CurrencyDollarIcon className={iconClass} />,
    })
  }

  const commitmentType = commitmentTypeLabel(doc?.commitment?.type || envelope.commitmentType)
  const duration = doc?.commitment?.duration
  if (commitmentType || duration) {
    facts.push({
      label: 'Commitment',
      value: [commitmentType, duration].filter(Boolean).join(' · '),
      icon: <BriefcaseIcon className={iconClass} />,
    })
  }

  const hoursPerWeek = doc?.commitment?.hoursPerWeek ?? envelope.hoursPerWeek
  if (hoursPerWeek) {
    facts.push({
      label: 'Hours',
      value: `Up to ${hoursPerWeek} hrs / week`,
      icon: <ClockIcon className={iconClass} />,
    })
  }

  const location =
    formatLocation(doc?.location) || envelope.location || locationTypeLabel(envelope.locationType)
  if (location) {
    facts.push({
      label: 'Location',
      value: location,
      icon: <MapPinIcon className={iconClass} />,
    })
  }

  if (doc?.location?.timezones) {
    facts.push({
      label: 'Timezones',
      value: doc.location.timezones,
      icon: <GlobeAltIcon className={iconClass} />,
    })
  }

  const level = doc?.level || envelope.level
  if (level) {
    facts.push({
      label: 'Level',
      value: level,
      icon: <AcademicCapIcon className={iconClass} />,
    })
  }

  if (doc?.commitment?.startDate) {
    facts.push({
      label: 'Start date',
      value: doc.commitment.startDate,
      icon: <CalendarDaysIcon className={iconClass} />,
    })
  }

  const deadlineLabel = formatDate(deadline)
  if (deadlineLabel) {
    facts.push({
      label: 'Applications close',
      value: deadlineLabel,
      icon: <CalendarDaysIcon className={iconClass} />,
    })
  }

  return facts
}

export default function JobFacts({ facts }: { facts: JobFact[] }) {
  if (!facts.length) return null

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-slate-700/20 to-slate-800/30 p-4"
        >
          {fact.icon}
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-slate-400">{fact.label}</dt>
            <dd className="text-sm text-white mt-0.5 break-words">{fact.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
