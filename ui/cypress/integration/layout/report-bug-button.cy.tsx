import * as NextRouter from 'next/router'
import {
  BUG_REPORT_REPO_URL,
  buildBugReportHref,
  formatBugReportEnvironment,
} from '@/lib/github/bugReport'
import ReportBugButton from '@/components/layout/ReportBugButton'

describe('buildBugReportHref', () => {
  it('uses issue-form field ids as query keys', () => {
    const href = buildBugReportHref({
      pageUrl: 'https://moondao.com/lock',
      environment: formatBugReportEnvironment({
        chain: 'mainnet',
        viewport: '1440x900',
        userAgent: 'Mozilla/5.0',
      }),
    })
    const url = new URL(href)

    expect(url.origin + url.pathname).to.eq(BUG_REPORT_REPO_URL)
    expect(url.searchParams.get('template')).to.eq('bug_report.yml')
    expect(url.searchParams.get('title')).to.eq('[Bug]: ')
    expect(url.searchParams.get('page-url')).to.eq('https://moondao.com/lock')
    expect(url.searchParams.get('environment')).to.eq(
      'Network: mainnet\nViewport: 1440x900\nUser agent: Mozilla/5.0'
    )
  })
})

describe('<ReportBugButton />', () => {
  beforeEach(() => {
    const useRouter = NextRouter.useRouter as any
    if (useRouter && typeof useRouter.restore === 'function') {
      useRouter.restore()
    }

    cy.stub(NextRouter, 'useRouter').returns({
      pathname: '/lock',
      asPath: '/lock',
      query: {},
      push: cy.stub().resolves(),
      replace: cy.stub().resolves(),
    })

    cy.mount(<ReportBugButton />)
  })

  it('renders a pill that opens the public GitHub bug form', () => {
    cy.get('#report-bug-button')
      .should('be.visible')
      .and('contain.text', 'Report a Bug')
      .and('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'noopener noreferrer')
      .and('have.attr', 'aria-label', 'Report a bug on GitHub')
  })

  it('links to the prefilled issue form with page and environment fields', () => {
    cy.get('#report-bug-button')
      .should('have.attr', 'href')
      .then((href) => {
        const url = new URL(href as unknown as string)
        expect(url.origin + url.pathname).to.eq(BUG_REPORT_REPO_URL)
        expect(url.searchParams.get('template')).to.eq('bug_report.yml')
        expect(url.searchParams.get('title')).to.eq('[Bug]: ')
        expect(url.searchParams.get('page-url')).to.include('/lock')
        expect(url.searchParams.get('environment')).to.include('Network:')
      })
  })
})
