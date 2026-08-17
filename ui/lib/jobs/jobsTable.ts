//server-side only
import JobsABI from 'const/abis/JobBoardTable.json'
import TeamABI from 'const/abis/Team.json'
import { JOBS_TABLE_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import { Chain } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { Job } from '@/components/jobs/Job'

function jobsContract(chain: Chain) {
  const chainSlug = getChainSlug(chain)
  return getContract({
    client: serverClient,
    address: JOBS_TABLE_ADDRESSES[chainSlug],
    chain: chain as any,
    abi: JobsABI as any,
  })
}

function teamsContract(chain: Chain) {
  const chainSlug = getChainSlug(chain)
  return getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[chainSlug],
    chain: chain as any,
    abi: TeamABI as any,
  })
}

export async function getJobsTableName(chain: Chain): Promise<string> {
  return (await readContract({
    contract: jobsContract(chain),
    method: 'getTableName' as string,
    params: [],
  })) as unknown as string
}

/**
 * Drop jobs whose team's subscription has lapsed.
 *
 * The previous implementation passed an `async` predicate to `Array.filter`, so
 * `filter` saw Promises (always truthy) and every job survived. Reads are
 * de-duplicated per team because a team usually posts more than one role.
 */
export async function filterJobsByActiveTeam(
  chain: Chain,
  jobs: Job[],
  now = Math.floor(Date.now() / 1000)
): Promise<Job[]> {
  if (!jobs?.length) return []

  const contract = teamsContract(chain)
  const teamIds = Array.from(new Set(jobs.map((job) => job.teamId)))

  const expirations = await Promise.all(
    teamIds.map(async (teamId) => {
      try {
        const expiresAt = await readContract({
          contract,
          method: 'expiresAt' as string,
          params: [teamId],
        })
        return [teamId, Number(expiresAt.toString())] as const
      } catch {
        // A read failure shouldn't silently hide a legitimate listing.
        return [teamId, Number.MAX_SAFE_INTEGER] as const
      }
    })
  )

  const expiresByTeam = new Map(expirations)
  return jobs.filter((job) => (expiresByTeam.get(job.teamId) ?? 0) > now)
}

export async function fetchActiveJobs(
  chain: Chain,
  now = Math.floor(Date.now() / 1000)
): Promise<Job[]> {
  const tableName = await getJobsTableName(chain)
  const statement = `SELECT * FROM ${tableName} WHERE (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`
  const jobs: Job[] = (await queryTable(chain, statement)) || []
  return filterJobsByActiveTeam(chain, jobs, now)
}

export async function fetchJobById(chain: Chain, id: number): Promise<Job | null> {
  if (!Number.isInteger(id) || id < 0) return null
  const tableName = await getJobsTableName(chain)
  const rows: Job[] = (await queryTable(chain, `SELECT * FROM ${tableName} WHERE id = ${id}`)) || []
  return rows[0] || null
}

/** Other open roles to surface at the bottom of a job page. */
export async function fetchRelatedJobs(
  chain: Chain,
  job: Job,
  limit = 4,
  now = Math.floor(Date.now() / 1000)
): Promise<Job[]> {
  const tableName = await getJobsTableName(chain)
  const statement = `SELECT * FROM ${tableName} WHERE id != ${job.id} AND (endTime = 0 OR endTime >= ${now}) ORDER BY id DESC`
  const jobs: Job[] = (await queryTable(chain, statement)) || []
  const active = await filterJobsByActiveTeam(chain, jobs, now)

  // Same team first, then same category, then newest.
  const score = (candidate: Job) =>
    (candidate.teamId === job.teamId ? 2 : 0) + (job.tag && candidate.tag === job.tag ? 1 : 0)

  return active.sort((a, b) => score(b) - score(a)).slice(0, limit)
}
