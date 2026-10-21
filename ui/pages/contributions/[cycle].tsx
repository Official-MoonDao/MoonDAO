import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import {
  allContributionCycles,
  getContributionReport,
  type ContributionReport as Report,
} from '@/lib/contributions/reports'
import ContributionReport from '@/components/contribution/ContributionReport'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import WebsiteHead from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type ContributionReportPageProps = {
  report: Report
}

export default function ContributionReportPage({ report }: ContributionReportPageProps) {
  return (
    <>
      {/* Reports name contributors and quote their claims: keep them out of
          search. next.config.js also sends X-Robots-Tag for /contributions/*. */}
      <WebsiteHead title={report.title} description={report.lede} robots="noindex, nofollow" />
      {/* Shell padding, this section, and ContentLayout each add a gutter.
          On a phone those stack into a narrow column. Below md, cancel the
          shell gutter and keep a single 16px margin. */}
      <section className="-mx-4 mt-5 flex w-[calc(100%+2rem)] animate-fadeIn flex-col items-start justify-start px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] md:mx-0 md:w-full md:px-5">
        <Container>
          <ContentLayout
            header={report.title}
            subHeader={report.eyebrow || undefined}
            description={report.lede || undefined}
            maxWidth="1040px"
            frameClassName="px-0 md:px-5"
            back={
              <Link
                href="/contributions"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                ← Community Circle
              </Link>
            }
            preFooter={
              <NoticeFooter
                defaultImage="../assets/MoonDAO-Logo-White.svg"
                defaultTitle="Need Help?"
                defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
                defaultButtonText="Submit a Ticket"
                defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
                imageWidth={200}
                imageHeight={200}
              />
            }
          >
            <ContributionReport html={report.bodyHtml} footnote={report.footnote} />
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: allContributionCycles().map((cycle) => ({ params: { cycle } })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<ContributionReportPageProps> = async ({ params }) => {
  const cycle = typeof params?.cycle === 'string' ? params.cycle : ''
  const report = getContributionReport(cycle)
  if (!report) return { notFound: true }
  return { props: { report } }
}
