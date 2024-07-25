import { useContract } from '@thirdweb-dev/react'
import {
  JOBS_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  TEAM_ADDRESSES,
} from 'const/config'
import { useContext, useEffect, useState } from 'react'
import useCitizen from '@/lib/citizen/useCitizen'
import ChainContext from '@/lib/thirdweb/chain-context'
import Job, { Job as JobType } from '../components/jobs/Job'
import Head from '../components/layout/Head'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Frame from '@/components/layout/Frame'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Search from '@/components/layout/Search'

export default function Jobs() {
  const { selectedChain } = useContext(ChainContext)

  const [jobs, setJobs] = useState<JobType[]>()
  const [filteredJobs, setFilteredJobs] = useState<JobType[]>()
  const [input, setInput] = useState('')

  const { contract: jobTableContract }: any = useContract(
    JOBS_TABLE_ADDRESSES[selectedChain.slug]
  )

  const { contract: teamContract } = useContract(
    TEAM_ADDRESSES[selectedChain.slug]
  )

  const citizen = useCitizen(selectedChain)

  async function getAllJobs() {
    const jobBoardTableName = await jobTableContract.call('getTableName')
    const statement = `SELECT * FROM ${jobBoardTableName}`

    const res = await fetch(`${TABLELAND_ENDPOINT}?statement=${statement}`)
    const data = await res.json()
    setJobs(data)
  }

  useEffect(() => {
    if (jobTableContract) getAllJobs()
  }, [jobTableContract])

  useEffect(() => {
    if (jobs && input != '') {
      setFilteredJobs(
        jobs.filter((job) => {
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
      <Head title="Jobs" image="" />
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
          <div className="pb-32 w-full flex flex-col gap-4">
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
        </ContentLayout>
      </Container>
    </section>
  )
}
