import { DEFAULT_CHAIN_V5, TEAM_ADDRESSES } from 'const/config'
import { useContext, useMemo, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import {
  JOB_COMMITMENT_TYPES,
  JOB_LOCATION_TYPES,
  JobMetadataEnvelope,
  getApplicationDeadline,
  parseJobMetadata,
} from '@/lib/jobs/jobMetadata'
import { fetchActiveJobs } from '@/lib/jobs/jobsTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Job, { Job as JobType } from '../components/jobs/Job'
import Head from '../components/layout/Head'
import CardGridContainer from '@/components/layout/CardGridContainer'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import StandardButton from '@/components/layout/StandardButton'
import TeamABI from '../const/abis/Team.json'

type JobsProps = {
  jobs: JobType[]
}

type SortOption = 'newest' | 'closing'

const ALL = 'all'

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
        active
          ? 'bg-blue-500/20 border-blue-400/40 text-blue-200'
          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  )
}

export default function Jobs({ jobs }: JobsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { citizen } = useContext(CitizenContext)

  const [input, setInput] = useState('')
  const [category, setCategory] = useState<string>(ALL)
  const [commitment, setCommitment] = useState<string>(ALL)
  const [location, setLocation] = useState<string>(ALL)
  const [paidOnly, setPaidOnly] = useState(false)
  const [sort, setSort] = useState<SortOption>('newest')

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })

  useChainDefault()

  const decorated = useMemo(
    () =>
      (jobs || []).map((job) => ({
        job,
        metadata: parseJobMetadata(job.metadata) as JobMetadataEnvelope,
      })),
    [jobs]
  )

  const categories = useMemo(() => {
    const tags = new Set<string>()
    decorated.forEach(({ job }) => {
      if (job.tag) tags.add(job.tag)
    })
    return Array.from(tags).sort()
  }, [decorated])

  const availableCommitments = useMemo(() => {
    const types = new Set<string>()
    decorated.forEach(({ metadata }) => {
      if (metadata.commitmentType) types.add(metadata.commitmentType)
    })
    return JOB_COMMITMENT_TYPES.filter((option) => types.has(option.value))
  }, [decorated])

  const availableLocations = useMemo(() => {
    const types = new Set<string>()
    decorated.forEach(({ metadata }) => {
      if (metadata.locationType) types.add(metadata.locationType)
    })
    return JOB_LOCATION_TYPES.filter((option) => types.has(option.value))
  }, [decorated])

  const hasPaidRoles = useMemo(
    () => decorated.some(({ metadata }) => metadata.paid || metadata.compensation),
    [decorated]
  )

  const filteredJobs = useMemo(() => {
    const query = input.trim().toLowerCase()

    const matches = decorated.filter(({ job, metadata }) => {
      if (query) {
        const haystack = [job.title, job.description, job.tag, ...(metadata.skills || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (category !== ALL && job.tag !== category) return false
      if (commitment !== ALL && metadata.commitmentType !== commitment) return false
      if (location !== ALL && metadata.locationType !== location) return false
      if (paidOnly && !(metadata.paid || metadata.compensation)) return false
      return true
    })

    if (sort === 'closing') {
      const far = Number.MAX_SAFE_INTEGER
      return matches
        .slice()
        .sort(
          (a, b) =>
            (getApplicationDeadline(a.metadata, a.job.endTime) || far) -
            (getApplicationDeadline(b.metadata, b.job.endTime) || far)
        )
        .map(({ job }) => job)
    }

    return matches
      .slice()
      .sort((a, b) => b.job.id - a.job.id)
      .map(({ job }) => job)
  }, [decorated, input, category, commitment, location, paidOnly, sort])

  const hasFilters =
    category !== ALL || commitment !== ALL || location !== ALL || paidOnly || input.trim() !== ''

  const descriptionSection = (
    <div className="pt-2 flex flex-col gap-4">
      <p className="text-slate-400">
        Explore opportunities with teams building the future of space exploration
      </p>
      <div className="w-fit max-w-[500px] bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 px-4 py-1">
        <Search
          input={input}
          setInput={setInput}
          className="w-full flex-grow"
          placeholder="Search roles, skills, teams..."
        />
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All roles"
            active={category === ALL}
            onClick={() => setCategory(ALL)}
          />
          {categories.map((tag) => (
            <FilterChip
              key={tag}
              label={tag}
              active={category === tag}
              onClick={() => setCategory(tag)}
            />
          ))}
        </div>
      )}

      {(availableCommitments.length > 0 || availableLocations.length > 0 || hasPaidRoles) && (
        <div className="flex flex-wrap gap-2 items-center">
          {availableCommitments.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={commitment === option.value}
              onClick={() => setCommitment(commitment === option.value ? ALL : option.value)}
            />
          ))}
          {availableLocations.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={location === option.value}
              onClick={() => setLocation(location === option.value ? ALL : option.value)}
            />
          ))}
          {hasPaidRoles && (
            <FilterChip label="Paid" active={paidOnly} onClick={() => setPaidOnly(!paidOnly)} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>
          {filteredJobs.length} open role{filteredJobs.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <span>Sort:</span>
          <button
            type="button"
            className={sort === 'newest' ? 'text-blue-300' : 'hover:text-white'}
            onClick={() => setSort('newest')}
          >
            Newest
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className={sort === 'closing' ? 'text-blue-300' : 'hover:text-white'}
            onClick={() => setSort('closing')}
          >
            Closing soon
          </button>
        </div>
        {hasFilters && (
          <button
            type="button"
            className="text-blue-400 hover:text-blue-300"
            onClick={() => {
              setInput('')
              setCategory(ALL)
              setCommitment(ALL)
              setLocation(ALL)
              setPaidOnly(false)
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )

  return (
    <section id="jobs-container" className="overflow-hidden">
      <Head
        title="Jobs"
        description={
          'Explore exciting opportunities in the space industry! Discover jobs posted by innovative teams within the Space Acceleration Network and accelerate your career in building a multiplanetary future.'
        }
        image="https://ipfs.io/ipfs/QmSuJQjNWDQn5Wht6d6PqUoten6DVm3cLocoHxi85G9N8T"
      />
      <Container>
        <ContentLayout
          header="Jobs"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="relative">
            {/* Blur overlay for non-citizens */}
            {!citizen && (
              <div className="absolute inset-0 z-10 bg-slate-900/40 backdrop-blur-[20px] rounded-2xl flex items-center justify-center">
                <div className="text-center px-6 relative z-20">
                  <div className="w-20 h-20 bg-blue-600/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg
                      className="w-10 h-10 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-GoodTimes text-white mb-4 drop-shadow-lg">
                    Citizens Only
                  </h3>
                  <p className="text-slate-300 mb-6 max-w-md mx-auto drop-shadow-md">
                    Become a MoonDAO Citizen to access the jobs board and connect with teams
                    building the future of space exploration.
                  </p>
                  <StandardButton
                    className="gradient-2 hover:opacity-90 transition-opacity"
                    textColor="text-white"
                    borderRadius="rounded-xl"
                    hoverEffect={false}
                    link="/citizen"
                  >
                    Become a Citizen
                  </StandardButton>
                </div>
              </div>
            )}

            <div className={citizen ? '' : 'pointer-events-none select-none'}>
              {filteredJobs?.[0] ? (
                <CardGridContainer>
                  {filteredJobs.map((job: JobType) => (
                    <Job key={`job-${job.id}`} job={job} showTeam teamContract={teamContract} />
                  ))}
                </CardGridContainer>
              ) : (
                <div className="mt-4 w-full h-[400px] flex flex-col gap-3 justify-center items-center">
                  <p>No jobs found.</p>
                  {hasFilters && (
                    <button
                      type="button"
                      className="text-sm text-blue-400 hover:text-blue-300"
                      onClick={() => {
                        setInput('')
                        setCategory(ALL)
                        setCommitment(ALL)
                        setLocation(ALL)
                        setPaidOnly(false)
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const jobs = await fetchActiveJobs(DEFAULT_CHAIN_V5)

    return {
      props: { jobs },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { jobs: [] },
      revalidate: 60,
    }
  }
}
