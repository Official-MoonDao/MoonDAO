import DistributionABI from 'const/abis/DistributionTable.json'
import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { blockedProjects } from 'const/whitelist'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getRelativeQuarter } from '@/lib/utils/dates'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import { Distribution } from '@/components/nance/RetroactiveRewards'

export default function RewardsThankYou({
  distributionTableName,
  projects,
}: {
  distributionTableName: string
  projects: any
}) {
  const account = useActiveAccount()
  const address = account?.address

  const [userDistribution, setUserDistribution] = useState<Distribution>()

  useEffect(() => {
    async function getUserDistribution() {
      const { quarter, year } = getRelativeQuarter(-1)

      const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE year = ${year} AND quarter = ${quarter}`
      const res = await fetch(
        `/api/tableland/query?statement=${distributionStatement}`
      )
      const distributions = await res.json()
      const userDist = distributions.find(
        (distribution: any) =>
          distribution?.address.toLowerCase() === address?.toLowerCase()
      )
      setUserDistribution(userDist)
    }

    if (address) getUserDistribution()
  }, [address, distributionTableName])

  const descriptionSection = (
    <p>You've successfully submitted your project allocations!</p>
  )

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
          <SectionCard>
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
          </SectionCard>
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

    const projectStatement = `SELECT * FROM ${projectTableName} WHERE year = ${year} AND quarter = ${quarter}`
    const projects = await queryTable(chain, projectStatement)
    const filteredProjects = projects.filter(
      (project: any) => !blockedProjects.includes(project?.id)
    )

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
    return {
      props: {
        distributionTableName: '',
        projects: [],
      },
      revalidate: 60,
    }
  }
}
