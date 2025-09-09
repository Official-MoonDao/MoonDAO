import {
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  TEAM_ADDRESSES,
} from 'const/config'
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
import StandardButton from '@/components/layout/StandardButton'
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
    <div className="pt-2">
      <div className="w-fit max-w-[500px] bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-xl border border-slate-600/30 px-3 py-1">
        <Search
          input={input}
          setInput={setInput}
          className="w-full flex-grow"
          placeholder="Search jobs..."
        />
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
          <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8 relative ${!citizen ? 'overflow-hidden' : ''}`}>
            {!citizen && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-GoodTimes text-white mb-3">Citizen Access Required</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    You must be a Citizen of the Space Acceleration Network to view the jobs board and explore career opportunities.
                  </p>
                  <StandardButton
                    className="gradient-2 hover:opacity-90 transition-opacity"
                    textColor="text-white"
                    borderRadius="rounded-xl"
                    hoverEffect={false}
                    link="/join"
                  >
                    Become a Citizen
                  </StandardButton>
                </div>
              </div>
            )}
            
            <div className={!citizen ? 'blur-sm pointer-events-none' : ''}>
              {filteredJobs?.[0] ? (
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
      revalidate: 60,
    }
  }
}
