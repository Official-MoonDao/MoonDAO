describe('MoonDAO App | Updates', () => {
  it('should list published updates on the index', () => {
    cy.visit('/updates', { timeout: 60000 })
    cy.contains('h2', 'The Master Plan', { timeout: 60000 }).should('be.visible')
    cy.contains('Essay').should('exist')
  })

  it('should list newsletter issues that open at news.moondao.com', () => {
    cy.visit('/updates', { timeout: 60000 })
    cy.contains('h3', 'Static Fire and UFOs', { timeout: 60000 })
      .closest('a')
      .should('have.attr', 'href')
      .and('match', /^https:\/\/news\.moondao\.com\/posts\//)
  })

  it('should list the same entries on /news and /updates', () => {
    const titles = (path: string) => {
      cy.visit(path, { timeout: 60000 })
      return cy.get('h2, h3').then(($headings) => $headings.toArray().map((h) => h.textContent))
    }
    titles('/updates').then((updates) => {
      titles('/news').then((news) => {
        expect(news.filter((t) => t && !updates.includes(t))).to.deep.equal([])
        expect(updates.filter((t) => t && !news.includes(t))).to.deep.equal([])
      })
    })
  })

  it('should render an update with its body and byline', () => {
    cy.visit('/updates/the-master-plan', { timeout: 60000 })
    cy.contains('h1', 'The Master Plan', { timeout: 60000 }).should('be.visible')
    cy.contains('Pablo Moncada-Larrotiz').should('be.visible')
    cy.contains('The Good').should('exist')
  })

  // Client-side navigation from a card is worth asserting because it cannot be
  // exercised on a dev server: `next dev` never settles a router.push to any
  // dynamic getStaticPaths route (pre-existing `/jobs/[id]` behaves the same),
  // so a card click looks broken locally while working in a real build. This
  // job runs against `next start`, which is where the behaviour is real.
  it('should navigate from the featured card to the update', () => {
    cy.visit('/updates', { timeout: 60000 })
    cy.contains('h2', 'The Master Plan', { timeout: 60000 }).should('be.visible').click()
    cy.location('pathname', { timeout: 60000 }).should('eq', '/updates/the-master-plan')
    cy.contains('All updates').should('be.visible')
  })

  it('should navigate back to the index from an update', () => {
    cy.visit('/updates/the-master-plan', { timeout: 60000 })
    cy.contains('All updates', { timeout: 60000 }).should('be.visible').click()
    cy.location('pathname', { timeout: 60000 }).should('eq', '/updates')
  })

  it('should surface recent updates on the press page', () => {
    cy.visit('/press', { timeout: 60000 })
    cy.contains('Latest updates', { timeout: 60000 }).should('exist')
    cy.contains('h3', 'The Master Plan').should('be.visible').click()
    cy.location('pathname', { timeout: 60000 }).should('eq', '/updates/the-master-plan')
  })

  it('should redirect the former /blog paths', () => {
    cy.visit('/blog', { timeout: 60000 })
    cy.location('pathname', { timeout: 60000 }).should('eq', '/updates')

    cy.visit('/blog/the-master-plan', { timeout: 60000 })
    cy.location('pathname', { timeout: 60000 }).should('eq', '/updates/the-master-plan')
  })

  it('should serve an article OG type and a per-update canonical', () => {
    cy.visit('/updates/the-master-plan', { timeout: 60000 })
    cy.get('meta[property="og:type"]').should('have.attr', 'content', 'article')
    cy.get('link[rel="canonical"]')
      .should('have.attr', 'href')
      .and('contain', '/updates/the-master-plan')
  })

  it('should publish an RSS feed', () => {
    cy.request('/updates/rss.xml').then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.contain('<title>The Master Plan</title>')
      expect(res.body).to.contain('/updates/the-master-plan')
    })
  })
})

export {}
