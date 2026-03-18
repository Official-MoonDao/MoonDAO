import {
  buildDashboardProjectLists,
  countDashboardCitizens,
  filterDashboardCitizens,
  getDashboardCitizenMetadata,
  getDashboardMissionSupportStat,
} from '@/lib/dashboard/dashboardData'
import { PROJECT_ACTIVE, PROJECT_PENDING } from '@/lib/nance/types'
import { getRecentPublicNewsletters } from '@/lib/newsletter/newsletterData'
import { NEXT_QUARTER_BUDGET_ETH } from 'const/config'

describe('dashboard data helpers', () => {
  it('filters out drafts (items without published_at)', () => {
    const newsletters = getRecentPublicNewsletters(
      [
        {
          id: 1,
          subject: 'Published newsletter',
          published_at: '2026-03-01T00:00:00.000Z',
          public_url: 'https://moondao.kit.com/posts/published-newsletter',
        },
        {
          id: 2,
          subject: 'Another published',
          published_at: '2026-03-02T00:00:00.000Z',
          public_url: null,
        },
        {
          id: 3,
          subject: 'Draft no date',
          created_at: '2026-03-03T00:00:00.000Z',
        },
      ],
      new Date('2026-03-17T00:00:00.000Z')
    )

    expect(newsletters).to.have.length(2)
    expect(newsletters[0].title).to.equal('Another published')
    expect(newsletters[1].title).to.equal('Published newsletter')
    expect(newsletters[0].url).to.equal(
      'https://news.moondao.com/posts/another-published'
    )
  })

  it('removes test citizens and normalizes x.com handles', () => {
    const citizens = [
      { id: 1, name: 'test' },
      { id: 2, name: 'Alice', twitter: 'https://x.com/moondaoalice' },
    ]

    const visibleCitizens = filterDashboardCitizens(citizens)

    expect(visibleCitizens.map((citizen) => citizen.name)).to.deep.equal(['Alice'])
    expect(getDashboardCitizenMetadata(visibleCitizens[0])).to.equal('@moondaoalice')
  })

  it('uses contributions for the featured mission support stat', () => {
    expect(getDashboardMissionSupportStat({ paymentsCount: '4' }, [])).to.deep.equal({
      label: 'Contributions',
      value: 4,
    })
  })

  it('includes the Citizens Space Policy Initiative in dashboard active projects', () => {
    const { currentProjects, proposals } = buildDashboardProjectLists([
      {
        id: 85,
        MDP: 196,
        name: 'Citizens Space Policy Initiative',
        active: 0,
        eligible: 0,
      },
      {
        id: 86,
        MDP: 197,
        name: 'Active Project',
        active: PROJECT_ACTIVE,
        eligible: 1,
      },
      {
        id: 87,
        MDP: 198,
        name: 'Pending Proposal',
        active: PROJECT_PENDING,
        eligible: 0,
      },
    ])

    expect(currentProjects.map((project) => project.name)).to.include(
      'Citizens Space Policy Initiative'
    )
    expect(
      currentProjects.find(
        (project) => project.name === 'Citizens Space Policy Initiative'
      )?.active
    ).to.equal(PROJECT_ACTIVE)
    expect(proposals.map((project) => project.name)).to.deep.equal(['Pending Proposal'])
  })

  it('reads the quarterly budget from the config constant', () => {
    expect(NEXT_QUARTER_BUDGET_ETH).to.be.a('number')
    expect(NEXT_QUARTER_BUDGET_ETH).to.be.greaterThan(0)
  })

  it('counts map citizens from grouped location data instead of a hardcoded value', () => {
    expect(
      countDashboardCitizens([
        { citizens: [{ id: 1 }, { id: 2 }] },
        { citizens: [{ id: 3 }] },
      ])
    ).to.equal(3)
  })
})
