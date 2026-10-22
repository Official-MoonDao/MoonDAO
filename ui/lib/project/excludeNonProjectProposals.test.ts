import assert from 'assert'
import { excludeNonProjectProposals } from './excludeNonProjectProposals'

type Row = { MDP: number; name: string; proposalIPFS?: string }

describe('excludeNonProjectProposals', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('drops governance proposals and keeps funded projects', async () => {
    global.fetch = (async (url: string) => ({
      ok: true,
      json: async () => ({ nonProjectProposal: String(url).includes('gov') }),
    })) as unknown as typeof fetch

    const projects: Row[] = [
      { MDP: 271, name: 'Executive Branch', proposalIPFS: 'https://ipfs/gov-eb' },
      { MDP: 267, name: 'Project System Update', proposalIPFS: 'https://ipfs/gov-system' },
      { MDP: 265, name: 'Lunar Base', proposalIPFS: 'https://ipfs/project' },
      { MDP: 1, name: 'No proposal JSON' },
    ]

    const kept = await excludeNonProjectProposals(projects)
    assert.deepStrictEqual(
      kept.map((project) => project.MDP),
      [265, 1]
    )
  })

  it('keeps a project when the proposal JSON cannot be read', async () => {
    global.fetch = (async () => {
      throw new Error('gateway down')
    }) as unknown as typeof fetch

    const projects: Row[] = [{ MDP: 10, name: 'Real project', proposalIPFS: 'https://ipfs/x' }]
    const kept = await excludeNonProjectProposals(projects)
    assert.deepStrictEqual(
      kept.map((project) => project.MDP),
      [10]
    )
  })

  it('keeps a project when the gateway returns an error status', async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 403,
      json: async () => {
        throw new Error('should not parse')
      },
    })) as unknown as typeof fetch

    const projects: Row[] = [{ MDP: 11, name: 'Real project', proposalIPFS: 'https://ipfs/y' }]
    const kept = await excludeNonProjectProposals(projects)
    assert.deepStrictEqual(
      kept.map((project) => project.MDP),
      [11]
    )
  })
})
