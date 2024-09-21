import { useState, useEffect } from 'react'
import { useContract } from '@thirdweb-dev/react'
import { PlusIcon, QueueListIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains'
import { PROJECT_TABLE_ADDRESSES, DISTRIBUTION_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
import { StringParam, useQueryParams, withDefault } from 'next-query-params'
import { useDebounce } from 'react-use'
import { NANCE_API_URL } from '../lib/nance/constants'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import Head from '../components/layout/Head'
import ProposalList from '../components/nance/ProposalList'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type ProjectType = {
  id: string
  title: string
  // ... other project properties
}

type ProjectsProps = {
  projects: ProjectType[]
}

export default function Projects({ projects }: ProjectsProps) {
  const [distributions, setDistributions] = useState<{ [key: string]: number }>({})
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3))

  const { contract: distributionTableContract } = useContract(DISTRIBUTION_TABLE_ADDRESSES[process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia'])

  const handleDistributionChange = (projectId: string, value: number) => {
    setDistributions(prev => ({ ...prev, [projectId]: Math.min(100, Math.max(1, value)) }))
  }

  const handleSubmit = async () => {
    const totalPercentage = Object.values(distributions).reduce((sum, value) => sum + value, 0)
    if (totalPercentage !== 100) {
      alert('Total distribution must equal 100%')
      return
    }

    try {
      await distributionTableContract.call('insertIntoTable', [
        year,
        quarter,
        JSON.stringify(distributions)
      ])
      alert('Distribution submitted successfully!')
    } catch (error) {
      console.error('Error submitting distribution:', error)
      alert('Error submitting distribution. Please try again.')
    }
  }

  return (
    <section id="projects-container" className="overflow-hidden">
      <Head title="Projects" image="" />
      <Container>
        <ContentLayout
          header="Projects"
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="pb-32 w-full flex flex-col gap-4">
            <div className="mb-4">
              <label className="mr-2">Year:</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="border rounded px-2 py-1"
              />
              <label className="ml-4 mr-2">Quarter:</label>
              <input
                type="number"
                value={quarter}
                onChange={(e) => setQuarter(Math.min(4, Math.max(1, parseInt(e.target.value))))}
                className="border rounded px-2 py-1"
                min="1"
                max="4"
              />
            </div>
            {projects && projects.map((project: ProjectType, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div>{project.title}</div>
                <input
                  type="number"
                  value={distributions[project.id] || ''}
                  onChange={(e) => handleDistributionChange(project.id, parseInt(e.target.value))}
                  className="border rounded px-2 py-1 w-20"
                  min="1"
                  max="100"
                />
              </div>
            ))}
            <button
              onClick={handleSubmit}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Submit Distribution
            </button>
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  const chain = Sepolia
  const sdk = initSDK(chain)

  const projectTableContract = await sdk.getContract(
    PROJECT_TABLE_ADDRESSES[chain.slug]
  )

  const distributionTableContract = await sdk.getContract(
    DISTRIBUTION_TABLE_ADDRESSES[chain.slug]
  )

  const projectBoardTableName = await projectTableContract.call('getTableName')
  const distributionTableName =
    await distributionTableContract.call('getTableName')

  const projectStatement = `SELECT * FROM ${projectBoardTableName}`
  const allProjectsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${projectStatement}`
  )
  const allProjects = await allProjectsRes.json()

  const now = Math.floor(Date.now() / 1000)
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.floor((new Date().getMonth() + 3) / 3)

  const distributionStatement = `SELECT * FROM ${distributionTableName} WHERE year = ${currentYear} AND quarter = ${currentQuarter}`
  const allDistributionsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${distributionStatement}`
  )
  const allDistributions = await allDistributionsRes.json()

  const distributions = allDistributions

  const validProjects = allProjects.filter(async (project: ProjectType) => {
    const teamExpiration = await teamContract.call('expiresAt', [
      project.teamId,
    ])
    return teamExpiration.toNumber() > now
  })

  return {
    props: {
      projects: validProjects,
      distributions,
    },
    revalidate: 60,
  }
}
