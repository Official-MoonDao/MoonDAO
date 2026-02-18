import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { BLOCKED_PROJECTS } from 'const/whitelist'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getRelativeQuarter } from '@/lib/utils/dates'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Card from '@/components/layout/Card'
import { Distribution } from '@/components/nance/ProjectRewards'

export default function RewardsThankYou({
  distributionTableName,
  projects,
}: {
  distributionTableName: string
  projects: any
}) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address

  const { quarter: fallbackQuarter, year: fallbackYear } = getRelativeQuarter(-1)

  const { quarter, year } = useMemo(() => {
    if (!router.isReady) return { quarter: fallbackQuarter, year: fallbackYear }
    const rawQuarter = Array.isArray(router.query.quarter) ? router.query.quarter[0] : router.query.quarter
    const rawYear = Array.isArray(router.query.year) ? router.query.year[0] : router.query.year
    const parsedQuarter = rawQuarter ? Number(rawQuarter) : undefined
    const parsedYear = rawYear ? Number(rawYear) : undefined
    return {
      quarter: parsedQuarter && parsedQuarter >= 1 && parsedQuarter <= 4 ? parsedQuarter : fallbackQuarter,
      year: parsedYear && parsedYear >= 2020 ? parsedYear : fallbackYear,
    }
  }, [router.isReady, router.query.quarter, router.query.year, fallbackQuarter, fallbackYear])

  const statement = address
    ? `SELECT * FROM ${distributionTableName} WHERE year = ${year} AND quarter = ${quarter}`
    : null

  const { data: distributions } = useTablelandQuery(statement, {
    revalidateOnFocus: false,
  })

  // Find user's distribution
  const userDistribution = useMemo(() => {
    if (!distributions || !address) return undefined
    return distributions.find(
      (distribution: any) => distribution?.address.toLowerCase() === address.toLowerCase()
    )
  }, [distributions, address])

  const descriptionSection = <p>{`You've successfully submitted your Q${quarter} ${year} project allocations!`}</p>

  return (
    <section id="jobs-container" className="overflow-hidden">
      <Head title={'Thank You'} />
      <Container>
        <ContentLayout
          header="Thank You!"
          headerSize="max(20px, 3vw)"
          description={descriptionSection}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <Card>
            <p>
              {`Thank you for performing your duty as a member of the MoonDAO community! Your allocation has been received. You can update your allocation at any time before the end of the quarter by resubmitting on the `}
              <Link href="/projects" className="text-light-warm">
                projects
              </Link>
              {` page`}
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {projects &&
                userDistribution &&
                userDistribution?.distribution &&
                projects?.map((project: any) => (
                  <div
                    key={`user-distribution-project-${project?.id}`}
                    className="p-2 bg-dark-cool"
                  >
                    <p className="font-GoodTimes">{`${
                      userDistribution?.distribution?.[project?.id] || 0
                    }% | ${project?.name}`}</p>
                  </div>
                ))}
            </div>
          </Card>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const projectTableContract = getContract({
      client: serverClient,
      chain,
      address: PROJECT_TABLE_ADDRESSES[chainSlug],
      abi: ProjectTableABI as any,
    })

    const projectTableName = await readContract({
      contract: projectTableContract,
      method: 'getTableName',
    })

    const { quarter, year } = getRelativeQuarter(-1)

    const projectStatement = `SELECT * FROM ${projectTableName} WHERE year = ${year} AND quarter = ${quarter} AND eligible != 0`
    const projects = await queryTable(chain, projectStatement)
    const filteredProjects = projects.filter((project: any) => !BLOCKED_PROJECTS.has(project?.id))

    const distributionTableContract = getContract({
      client: serverClient,
      chain,
      address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
      abi: DistributionABI as any,
    })

    const distributionTableName = await readContract({
      contract: distributionTableContract,
      method: 'getTableName',
    })

    return {
      props: {
        distributionTableName,
        projects: filteredProjects,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: {
        distributionTableName: '',
        projects: [],
      },
      revalidate: 60,
    }
  }
}
