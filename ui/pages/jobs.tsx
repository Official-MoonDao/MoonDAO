import {
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  TEAM_ADDRESSES,
  DEFAULT_CHAIN,
} from 'const/config'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { getContract, readContract } from 'thirdweb'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContext from '@/lib/thirdweb/chain-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { serverClient } from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { initSDK } from '@/lib/thirdweb/thirdweb'
import Job, { Job as JobType } from '../components/jobs/Job'
import Head from '../components/layout/Head'
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
  const { citizen } = useContext(CitizenContext)

  const [filteredJobs, setFilteredJobs] = useState<JobType[]>()
  const [input, setInput] = useState('')

  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const teamContract = useContract({
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: selectedChain,
  })

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
            <div className="pb-10 w-full flex flex-col gap-4">
              {filteredJobs &&
                filteredJobs.map((job: JobType, i: number) => (
                  <Job
                    key={`job-${i}`}
                    job={job}
                    showTeam
                    teamContract={teamContract}
                  />
                ))}
            </div>
          ) : (
            <>
              <p className="">
                {
                  '⚠️ You must be a Citizen of the Space Acceleration Network to view the job board. If you are already a Citizen, please sign in.'
                }
              </p>
              <Link href="/citizen" passHref>
                <CitizenTier setSelectedTier={() => {}} compact />
              </Link>
            </>
          )}
        </ContentLayout>
      </Container>
    </section>
  )
}

export async function getStaticProps() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const now = Math.floor(Date.now() / 1000)

  const jobTableContract = getContract({
    client: serverClient,
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    abi: JobsABI as any,
    chain: chain,
  })
  const teamContract = getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[chainSlug],
    abi: TeamABI as any,
    chain: chain,
  })

  const jobBoardTableName = await readContract({
    contract: jobTableContract,
    method: 'getTableName' as string,
    params: [],
  })

  const statement = `SELECT * FROM ${jobBoardTableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`

  const allJobsRes = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
  const allJobs = await allJobsRes.json()

  const validJobs = allJobs?.filter(async (job: JobType) => {
    const teamExpiration = await readContract({
      contract: teamContract,
      method: 'expiresAt' as string,
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
}
