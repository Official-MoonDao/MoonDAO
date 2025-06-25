import {
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useContract from '@/lib/thirdweb/hooks/useContract'
import Job, { Job as JobType } from '../components/jobs/Job'
import Head from '../components/layout/Head'
import CardGridContainer from '@/components/layout/CardGridContainer'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'
import CitizenTier from '@/components/onboarding/CitizenTier'
import JobsABI from '../const/abis/JobBoardTable.json'
import TeamABI from '../const/abis/Team.json'

type JobsProps = {
  jobs: JobType[]
}

export default function Jobs({ jobs }: JobsProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { citizen } = useContext(CitizenContext)

  const [filteredJobs, setFilteredJobs] = useState<JobType[]>()
  const [input, setInput] = useState('')

  const teamContract = useContract({
    chain: selectedChain,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
  })

  useChainDefault()

  useEffect(() => {
    if (jobs && input != '') {
      setFilteredJobs(
        jobs.filter((job: JobType) => {
          return job.title.toLowerCase().includes(input.toLowerCase())
        })
      )
    } else {
      setFilteredJobs(jobs)
    }
  }, [jobs, input])

  const descriptionSection = (
    <div>
      <Frame
        bottomLeft="20px"
        topLeft="5vmax"
        marginBottom="30px"
        marginTop="30px"
        noPadding
      >
        <Search input={input} setInput={setInput} />
      </Frame>
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
          {citizen ? (
            filteredJobs?.[0] ? (
              <CardGridContainer>
                {filteredJobs.map((job: JobType, i: number) => (
                  <Job
                    key={`job-${i}`}
                    job={job}
                    showTeam
                    teamContract={teamContract}
                  />
                ))}
              </CardGridContainer>
            ) : (
              <div className="mt-4 w-full h-[400px] flex justify-center items-center">
                <p className="">No jobs found.</p>
              </div>
            )
          ) : (
            <div className="md:mb-[5vw] 2xl:mb-[2vw]">
              <p className="p-5 md:p-0">
                {
                  '⚠️ You must be a Citizen of the Space Acceleration Network to view the job board. If you are already a Citizen, please sign in.'
                }
              </p>
              <Link href="/citizen" passHref>
                <CitizenTier setSelectedTier={() => {}} compact />
              </Link>
            </div>
          )}
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  try {
    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const now = Math.floor(Date.now() / 1000)

    const jobTableContract = getContract({
      client: serverClient,
      address: JOBS_TABLE_ADDRESSES[chainSlug],
      chain: chain,
      abi: JobsABI as any,
    })
    const teamContract = getContract({
      client: serverClient,
      address: TEAM_ADDRESSES[chainSlug],
      chain: chain,
      abi: TeamABI as any,
    })

    const jobBoardTableName = await readContract({
      contract: jobTableContract,
      method: 'getTableName',
    })

    const statement = `SELECT * FROM ${jobBoardTableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`

    const allJobs = await queryTable(chain, statement)

    const validJobs = allJobs?.filter(async (job: any) => {
      const teamExpiration = await readContract({
        contract: teamContract,
        method: 'expiresAt',
        params: [job.teamId],
      })
      return +teamExpiration.toString() > now
    })

    return {
      props: {
        jobs: validJobs,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error(error)
    return {
      props: { jobs: [] },
    }
  }
}
