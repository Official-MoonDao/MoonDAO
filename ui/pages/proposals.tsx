import {
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import { NanceProvider } from '@nance/nance-hooks'
import {
  PROJECT_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  PROJECT_CYCLE,
} from 'const/config'
import {
  PROPOSALS_FILM_UPLOAD_DATE,
  PROPOSALS_FILM_VIMEO_ID,
  proposalsFilm,
} from 'const/proposalsPageContent'
import { GetServerSideProps } from 'next'
import { StringParam, useQueryParams } from 'next-query-params'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { NANCE_API_URL } from '../lib/nance/constants'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { serializeJsonLd } from '@/lib/utils/jsonLd'
import { useLivePhase } from '@/lib/operator/useLivePhase'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import {
  daysUntilDate,
  formatSubmissionWindowClose,
  getSubmissionWindowClose,
} from '@/lib/utils/dates'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import ProposalEditor from '../components/nance/ProposalEditor'
import {
  ProposalBudgetTiles,
  ProposalCycleStatus,
} from '@/components/project/ProposalCycleStats'
import ProposalsHero from '@/components/project/ProposalsHero'

export default function ProposalsPage({ project }: { project: Project }) {
  const title = 'Propose Project'

  useChainDefault()
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')
  const { phase, isIntake } = useLivePhase()
  const submissionDeadline = getSubmissionWindowClose()
  const submissionCloseLabel = formatSubmissionWindowClose(submissionDeadline).label
  const daysLeft = daysUntilDate(submissionDeadline)
  const submissionsClosed =
    PROJECT_CYCLE.enforceSubmissionDeadline &&
    isIntake &&
    Date.now() >= submissionDeadline.getTime()
  const isEditingExisting = Boolean(project)
  // Authors back to edit a proposal land straight on the editor, not the film.
  const showHero = Boolean(PROPOSALS_FILM_VIMEO_ID) && !isEditingExisting

  const cycleStats = (
    <>
      <ProposalCycleStatus
        phase={phase}
        isIntake={isIntake}
        submissionsClosed={submissionsClosed}
        submissionCloseLabel={submissionCloseLabel}
        daysLeft={daysLeft}
      />
      <ProposalBudgetTiles />
    </>
  )

  return (
    <>
      <WebsiteHead
        title={title}
        description="Submit a proposal to receive financing or special permissions from the MoonDAO community. Get your project funded and bring your space-related ideas to life."
      >
        {PROPOSALS_FILM_VIMEO_ID && (
          <script
            type="application/ld+json"
            key="proposals-film-jsonld"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd({
                '@context': 'https://schema.org',
                '@type': 'VideoObject',
                name: proposalsFilm.name,
                description: proposalsFilm.description,
                thumbnailUrl: `${DEPLOYED_ORIGIN}${proposalsFilm.poster}`,
                ...(PROPOSALS_FILM_UPLOAD_DATE && { uploadDate: PROPOSALS_FILM_UPLOAD_DATE }),
                duration: proposalsFilm.duration,
                embedUrl: `https://player.vimeo.com/video/${PROPOSALS_FILM_VIMEO_ID}`,
              }),
            }}
          />
        )}
      </WebsiteHead>
      {showHero && <ProposalsHero title={title} stats={cycleStats} />}
      <section className="flex flex-col justify-start px-2 md:px-5 mt-3 md:mt-5 items-start animate-fadeIn w-full">
        <Container>
          <ContentLayout
            header={showHero ? undefined : 'Propose Project'}
            mainPadding
            mode="compact"
            isProfile={true}
          >
            {/* Main Content Area */}
            <div className="flex flex-col gap-5 md:gap-8 max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              {!showHero && cycleStats}

              {/* Step 1: Get the Template - Most Prominent */}
              <div
                id="get-template"
                className="scroll-mt-24 bg-gradient-to-br from-slate-900/80 via-blue-950/40 to-slate-900/80 backdrop-blur-xl border border-blue-500/25 rounded-2xl p-4 md:p-8 shadow-xl">
                <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      Get the Proposal Template
                    </h2>
                    <p className="text-gray-300">
                      Use the canonical markdown template (novelty &amp; prior art, lunar bridge,
                      budget classes, IP, checklist). Ask must stay within the posted quarterly max.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Link
                    href="/proposal-template"
                    className="flex-1 inline-flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white rounded-xl transition-all duration-300 shadow-lg text-sm md:text-base font-semibold group"
                  >
                    <DocumentDuplicateIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    Open template &amp; copy
                  </Link>

                  <Link
                    href="https://docs.google.com/document/d/1p8rV9RlvFk6nAJzWh-tvroyPvasjjrvgKpyX8ibGX3I/edit?usp=sharing"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-3 md:py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 text-sm font-medium border border-white/20"
                  >
                    Google Doc
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 opacity-70" />
                  </Link>

                  <Link
                    href="/project-system-docs"
                    className="inline-flex items-center justify-center gap-2 px-4 md:px-5 py-3 md:py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 text-sm font-medium border border-white/20"
                  >
                    <QuestionMarkCircleIcon className="w-5 h-5" />
                    Docs
                  </Link>
                </div>

                <div className="mt-4 md:mt-5 grid gap-3 md:grid-cols-2">
                  <div className="p-3 md:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-200">
                      <strong>Import tip:</strong> Paste into a Google Doc, set sharing to{' '}
                      <span className="font-semibold">
                        &quot;Anyone with the link can view&quot;
                      </span>
                      , then import below.
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-lg">
                    <p className="text-sm text-gray-300">
                      <strong>Required sections:</strong> Novelty &amp; Prior Art, Lunar Bridge,
                      Community Standing, SMART Key Results, Budget classes (no foundational PCs /
                      entity fees), IP disclosure, COTS rationale for hardware.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Import Your Document */}
              <div className="bg-gradient-to-br from-gray-900/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-8 shadow-xl">
                <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      Import & Submit Your Proposal
                    </h2>
                    <p className="text-gray-300">
                      Paste your Google Doc link below to import your proposal, then submit it for
                      review.
                    </p>
                  </div>
                </div>

                {submissionsClosed && !isEditingExisting ? (
                  <p className="text-sm text-amber-200">
                    New submissions are closed for this cycle. Come back after Senate Vote opens to
                    file for the next quarter.
                  </p>
                ) : (
                  <ProposalEditor project={project} />
                )}
              </div>

              {/* Step 3: Present at Town Hall - Compact */}
              <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      3
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">Present at Town Hall</h3>
                      <p className="text-sm text-gray-400">
                        After submitting, present your proposal at our weekly Town Hall meeting.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="https://moondao.com/discord"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 text-sm border border-white/10 w-full sm:w-auto"
                  >
                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                    Join Discord
                  </Link>
                </div>
              </div>
            </div>
          </ContentLayout>
          <NoticeFooter
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Need Help?"
            defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
            defaultButtonText="Submit a Ticket"
            defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            imageWidth={200}
            imageHeight={200}
          />
        </Container>
      </section>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const tokenId: any = query?.tokenId
  if (!tokenId) {
    return {
      props: {},
    }
  }
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const statement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE id = ${tokenId}`
  const projects = await queryTable(chain, statement)
  const project = projects[0]
  if (!projects.length) {
    return {
      props: {},
    }
  }
  return {
    props: { project },
  }
}
