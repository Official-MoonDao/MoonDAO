import { useContract } from '@thirdweb-dev/react'
import { JOBS_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
import { useContext, useEffect, useState } from 'react'
import ChainContext from '@/lib/thirdweb/chain-context'
import Job, { Job as JobType } from '../components/jobs/Job'
import Head from '../components/layout/Head'
import Search from '@/components/layout/Search'

export default function Jobs() {
  const { selectedChain } = useContext(ChainContext)

  const [jobs, setJobs] = useState<JobType[]>()
  const [filteredJobs, setFilteredJobs] = useState<JobType[]>()
  const [input, setInput] = useState('')

  const { contract: jobTableContract }: any = useContract(
    JOBS_TABLE_ADDRESSES[selectedChain.slug]
  )

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

  return (
    <main className="animate-fadeIn">
      <Head title="Jobs" image="" />
      <div className="flex flex-col items-center lg:items-start space-y-10 mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 bg-[white] dark:bg-[#080C20] font-RobotoMono w-[350px] sm:w-[400px] lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white page-border-and-color">
        <h1 className={`page-title`}>Jobs</h1>

        <Search input={input} setInput={setInput} />

        <div className="w-full flex flex-col gap-4">
          {filteredJobs &&
            filteredJobs.map((job: JobType, i: number) => (
              <Job key={`job-${i}`} job={job} />
            ))}
        </div>
      </div>
    </main>
  )
}
