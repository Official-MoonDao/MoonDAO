import { DEPLOYED_ORIGIN } from 'const/config'
import { Job } from '@/components/jobs/Job'
import {
  JobCommitmentType,
  JobCompensationPeriod,
  JobMetadataEnvelope,
  JobPostingDoc,
  getApplicationDeadline,
} from './jobMetadata'

const EMPLOYMENT_TYPES: Record<JobCommitmentType, string> = {
  'full-time': 'FULL_TIME',
  'part-time': 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
  bounty: 'CONTRACTOR',
  volunteer: 'VOLUNTEER',
}

const SALARY_UNITS: Record<JobCompensationPeriod, string> = {
  hour: 'HOUR',
  week: 'WEEK',
  month: 'MONTH',
  year: 'YEAR',
  project: 'MONTH',
}

/**
 * schema.org JobPosting markup, which is what gets a listing into Google Jobs.
 * Free distribution for every role on the board, so it is worth emitting even
 * for postings that only fill in the four original fields.
 */
export function buildJobPostingJsonLd({
  job,
  envelope,
  doc,
  teamName,
}: {
  job: Job
  envelope: JobMetadataEnvelope
  doc?: JobPostingDoc | null
  teamName?: string
}) {
  const deadline = getApplicationDeadline(envelope, job.endTime)
  const compensation = doc?.compensation
  const commitmentType = doc?.commitment?.type || envelope.commitmentType
  const locationType = doc?.location?.type || envelope.locationType

  const description = [doc?.summary || job.description, doc?.body].filter(Boolean).join('\n\n')

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description,
    identifier: {
      '@type': 'PropertyValue',
      name: teamName || 'MoonDAO',
      value: String(job.id),
    },
    datePosted: job.timestamp ? new Date(job.timestamp * 1000).toISOString() : undefined,
    validThrough: deadline ? new Date(deadline * 1000).toISOString() : undefined,
    employmentType: commitmentType ? EMPLOYMENT_TYPES[commitmentType] : undefined,
    hiringOrganization: {
      '@type': 'Organization',
      name: teamName || 'MoonDAO',
      sameAs: DEPLOYED_ORIGIN,
    },
    directApply: false,
    url: `${DEPLOYED_ORIGIN}/jobs/${job.id}`,
  }

  if (doc?.skills?.length) {
    jsonLd.skills = doc.skills.join(', ')
  }

  if (locationType === 'remote' || !locationType) {
    jsonLd.jobLocationType = 'TELECOMMUTE'
    jsonLd.applicantLocationRequirements = {
      '@type': 'Country',
      name: doc?.location?.region || 'Worldwide',
    }
  } else if (doc?.location?.region) {
    jsonLd.jobLocation = {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: doc.location.region },
    }
  }

  if (compensation && (compensation.min !== undefined || compensation.max !== undefined)) {
    const value: Record<string, any> = {
      '@type': 'QuantitativeValue',
      unitText: SALARY_UNITS[compensation.period || 'month'],
    }
    if (compensation.min !== undefined && compensation.max !== undefined) {
      value.minValue = compensation.min
      value.maxValue = compensation.max
    } else {
      value.value = compensation.min ?? compensation.max
    }
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: compensation.currency || 'USD',
      value,
    }
  }

  return Object.fromEntries(Object.entries(jsonLd).filter(([, value]) => value !== undefined))
}

/** Re-exported so existing job callers keep a single import; see lib/utils/jsonLd. */
export { serializeJsonLd } from '@/lib/utils/jsonLd'
