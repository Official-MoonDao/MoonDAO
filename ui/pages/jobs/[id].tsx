import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import TeamABI from 'const/abis/Team.json'
import { DEFAULT_CHAIN_V5, DEPLOYED_ORIGIN, TEAM_ADDRESSES } from 'const/config'
import { GetStaticPaths, GetStaticProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import {
  JOB_DETAIL_PUBLIC,
  JobMetadataEnvelope,
  JobPostingDoc,
  formatCompensation,
  formatDeadlineCountdown,
  formatLocation,
  getApplicationDeadline,
  parseJobMetadata,
} from '@/lib/jobs/jobMetadata'
import { fetchJobPostingDoc } from '@/lib/jobs/jobPostingDoc'
import { buildJobPostingJsonLd, serializeJsonLd } from '@/lib/jobs/jobPostingJsonLd'
import { fetchJobById, fetchRelatedJobs } from '@/lib/jobs/jobsTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import JobComponent, { Job as JobType } from '@/components/jobs/Job'
import JobApplyPanel from '@/components/jobs/JobApplyPanel'
import JobFacts, { buildJobFacts } from '@/components/jobs/JobFacts'
import JobSection, { JobBulletList, JobStepList } from '@/components/jobs/JobSection'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import StandardButton from '@/components/layout/StandardButton'
import MarkdownWithTOC from '@/components/nance/MarkdownWithTOC'

type JobDetailProps = {
  job: JobType
  metadata: JobMetadataEnvelope
  doc: JobPostingDoc | null
  team: { id: number; name: string; image: string } | null
  relatedJobs: JobType[]
  otherRolesCount: number
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/90">
      {children}
    </span>
  )
}

export default function JobDetail({
  job,
  metadata,
  doc,
  team,
  relatedJobs,
  otherRolesCount,
}: JobDetailProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { citizen } = useContext(CitizenContext)
  useChainDefault()

  const isGated = !JOB_DETAIL_PUBLIC && !citizen
  const [clientDoc, setClientDoc] = useState<JobPostingDoc | null>(null)
  const posting = isGated ? null : doc || clientDoc

  // ISR can ship without the IPFS body (slow gateway). Retry in the browser
  // whenever the on-chain envelope has a CID but the server did not load it.
  useEffect(() => {
    if (doc || !metadata.cid || isGated) return
    let cancelled = false
    fetchJobPostingDoc(metadata.cid).then((loaded) => {
      if (!cancelled && loaded) setClientDoc(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [doc, metadata.cid, isGated])

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })

  const deadline = getApplicationDeadline(metadata, job.endTime)
  const summary = posting?.summary || job.description
  const applyUrl = isGated ? undefined : posting?.applyUrl || job.contactInfo
  const teamHref = team ? `/team/${team.id}` : undefined
  const shareUrl = `${DEPLOYED_ORIGIN}/jobs/${job.id}`
  const facts = buildJobFacts({ envelope: metadata, doc: posting, deadline })

  const compensation = formatCompensation(posting?.compensation) || metadata.compensation
  const location = formatLocation(posting?.location) || metadata.location
  const commitment = metadata.commitment

  // The page is served from an ISR cache, so a "closes in N days" badge rendered
  // on the server would disagree with the client on hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const countdown = mounted ? formatDeadlineCountdown(deadline) : null

  const jsonLd = isGated
    ? null
    : buildJobPostingJsonLd({
        job,
        envelope: metadata,
        doc: posting,
        teamName: team?.name,
      })

  const titleSection = (
    <div className="pt-2 flex flex-col gap-4">
      {team && (
        <Link
          href={`/team/${team.id}`}
          className="flex items-center gap-3 w-fit text-blue-400 hover:text-blue-300"
        >
          {team.image && (
            <Image
              src={getIPFSGateway(team.image)}
              alt={team.name}
              width={32}
              height={32}
              className="rounded-full object-cover h-8 w-8"
              unoptimized
            />
          )}
          <span className="text-sm">{team.name}</span>
        </Link>
      )}
      <div className="flex flex-wrap gap-2">
        {job.tag && <Badge>{job.tag}</Badge>}
        {commitment && <Badge>{commitment}</Badge>}
        {location && <Badge>{location}</Badge>}
        {compensation && <Badge>{compensation}</Badge>}
        {countdown && <Badge>{countdown}</Badge>}
      </div>
      {summary && <p className="text-slate-300 max-w-3xl leading-relaxed">{summary}</p>}
    </div>
  )

  return (
    <>
      <Head
        title={job.title}
        secondaryTitle={team?.name ? `${team.name} · MoonDAO Jobs` : 'MoonDAO Jobs'}
        description={summary}
      >
        {jsonLd && (
          <script
            type="application/ld+json"
            key="job-posting-jsonld"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
          />
        )}
      </Head>
      <Container>
        <ContentLayout
          header={job.title}
          headerSize="max(20px, 3vw)"
          description={titleSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="pb-24 lg:pb-10">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              All open roles
            </Link>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
              <div className="min-w-0">
                <JobFacts facts={facts} />

                {isGated && (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    <h3 className="font-GoodTimes text-white text-lg mb-2">Citizens Only</h3>
                    <p className="text-slate-300 mb-5 max-w-md mx-auto">
                      Become a MoonDAO Citizen to read the full role description and apply.
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
                )}

                {posting?.body && (
                  <div className="mt-8">
                    <MarkdownWithTOC body={posting.body} />
                  </div>
                )}

                {!isGated && !posting?.body && (
                  <div className="mt-8">
                    <p className="text-white/90 text-base leading-relaxed whitespace-pre-line">
                      {job.description}
                    </p>
                  </div>
                )}

                {posting?.responsibilities?.length ? (
                  <JobSection id="responsibilities" header="What you'll own">
                    <JobBulletList items={posting.responsibilities} />
                  </JobSection>
                ) : null}

                {posting?.requirements?.length ? (
                  <JobSection id="requirements" header="What we're looking for">
                    <JobBulletList items={posting.requirements} checkmarks />
                  </JobSection>
                ) : null}

                {posting?.niceToHave?.length ? (
                  <JobSection id="nice-to-have" header="Nice to have">
                    <JobBulletList items={posting.niceToHave} />
                  </JobSection>
                ) : null}

                {posting?.successCriteria?.length ? (
                  <JobSection id="success" header="What success looks like">
                    <JobBulletList items={posting.successCriteria} checkmarks />
                  </JobSection>
                ) : null}

                {posting?.whatWeOffer?.length ? (
                  <JobSection id="what-we-offer" header="What we give you">
                    <JobBulletList items={posting.whatWeOffer} />
                  </JobSection>
                ) : null}

                {!isGated && (compensation || posting?.compensation?.notes) && (
                  <JobSection id="compensation" header="Compensation">
                    {compensation && (
                      <p className="text-white text-lg font-semibold">
                        {compensation}
                        {posting?.compensation?.paidIn ? (
                          <span className="text-white/70 text-base font-normal">
                            {' '}
                            · {posting.compensation.paidIn}
                          </span>
                        ) : null}
                      </p>
                    )}
                    {posting?.compensation?.notes && (
                      <p className="text-white/80 mt-2 leading-relaxed">
                        {posting.compensation.notes}
                      </p>
                    )}
                  </JobSection>
                )}

                {posting?.applicationRequirements?.length ? (
                  <JobSection id="how-to-apply" header="How to apply">
                    <JobBulletList items={posting.applicationRequirements} />
                  </JobSection>
                ) : null}

                {posting?.hiringProcess?.length ? (
                  <JobSection id="process" header="Hiring process">
                    <JobStepList steps={posting.hiringProcess} />
                  </JobSection>
                ) : null}

                {posting?.skills?.length ? (
                  <JobSection id="skills" header="Skills">
                    <div className="flex flex-wrap gap-2">
                      {posting.skills.map((skill) => (
                        <Badge key={skill}>{skill}</Badge>
                      ))}
                    </div>
                  </JobSection>
                ) : null}

                {posting?.links?.length ? (
                  <JobSection id="links" header="Worth reading before you apply">
                    <ul className="flex flex-col gap-2">
                      {posting.links.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                          >
                            {link.label}
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </JobSection>
                ) : null}
              </div>

              <aside className="lg:sticky lg:top-6 w-full">
                {!isGated && (
                  <JobApplyPanel
                    applyUrl={applyUrl}
                    deadline={deadline}
                    postedAt={job.timestamp}
                    teamName={team?.name}
                    teamHref={teamHref}
                    shareUrl={shareUrl}
                    shareText={`${job.title}${team?.name ? ` at ${team.name}` : ' at MoonDAO'}`}
                    otherRolesCount={otherRolesCount}
                  />
                )}

                {!citizen && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="font-GoodTimes text-white text-base leading-tight mb-2">
                      New to MoonDAO?
                    </p>
                    <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                      Citizens of the Space Acceleration Network see every open role on the board,
                      plus the teams and projects behind them.
                    </p>
                    <StandardButton
                      className="w-full gradient-2 hover:opacity-90 transition-opacity"
                      textColor="text-white"
                      borderRadius="rounded-xl"
                      hoverEffect={false}
                      link="/citizen"
                    >
                      Become a Citizen
                    </StandardButton>
                  </div>
                )}
              </aside>
            </div>

            {relatedJobs.length > 0 && (
              <JobSection id="related" header="Other open roles">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {relatedJobs.map((related) => (
                    <JobComponent
                      key={`related-${related.id}`}
                      job={related}
                      showTeam
                      teamContract={teamContract}
                    />
                  ))}
                </div>
              </JobSection>
            )}
          </div>
        </ContentLayout>
      </Container>

      {applyUrl && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-900/95 backdrop-blur px-4 py-3">
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600"
          >
            Apply now
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
        </div>
      )}
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: 'blocking',
})

export const getStaticProps: GetStaticProps<JobDetailProps> = async ({ params }) => {
  const chain = DEFAULT_CHAIN_V5
  const id = Number(params?.id)

  if (!Number.isInteger(id) || id < 0) {
    return { notFound: true }
  }

  try {
    const job = await fetchJobById(chain, id)
    if (!job) return { notFound: true, revalidate: 60 }

    const metadata = parseJobMetadata(job.metadata)

    // Everything below is best-effort: a slow gateway or degraded RPC should
    // narrow the page, not 500 it.
    const [doc, team, related] = await Promise.all([
      fetchJobPostingDoc(metadata.cid),
      loadTeamSummary(chain, job.teamId),
      fetchRelatedJobs(chain, job).catch(() => ({ jobs: [] as JobType[], otherCount: 0 })),
    ])

    return {
      props: {
        job,
        metadata,
        doc,
        team,
        relatedJobs: related.jobs,
        otherRolesCount: related.otherCount,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(`Failed to build job page ${id}:`, error)
    return { notFound: true, revalidate: 60 }
  }
}

async function loadTeamSummary(chain: any, teamId: number) {
  try {
    const { fetchTeamWithOwner } = await import('@/lib/team/teamDataService')
    const team = await fetchTeamWithOwner(chain, teamId)
    if (!team) return null
    return {
      id: teamId,
      name: (team.metadata?.name as string) || `Team #${teamId}`,
      image: (team.metadata?.image as string) || '',
    }
  } catch (error) {
    console.error(`Failed to load team ${teamId} for job page:`, error)
    return null
  }
}
