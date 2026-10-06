import CookieBanner from '@/components/layout/CookieBanner'

describe('<CookieBanner />', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win: any) => {
      win.gtag = cy.stub().as('gtagStub')
    })
    // Default to a non-US country so the banner renders for most tests.
    cy.intercept('GET', '/api/geo/country', { body: { country: 'GB' } }).as('geoCountry')
  })

  it('Renders when cookie consent is null', () => {
    cy.mount(<CookieBanner />)
    cy.contains('We use cookies for analytics and personalization').should('be.visible')
  })

  it('Hides the banner and grants consent for US users', () => {
    cy.intercept('GET', '/api/geo/country', { body: { country: 'US' } }).as('geoCountryUS')
    cy.mount(<CookieBanner />)
    cy.wait('@geoCountryUS')
    cy.contains('We use cookies for analytics and personalization').should('not.exist')
    cy.get('@gtagStub').should('have.been.calledWith', 'consent', 'update', {
      analytics_storage: 'granted',
    })
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('true')
    })
  })

  it('Hides the banner for US territories and USA-shaped codes', () => {
    cy.intercept('GET', '/api/geo/country', { body: { country: 'PR' } }).as('geoPR')
    cy.mount(<CookieBanner />)
    cy.wait('@geoPR')
    cy.contains('We use cookies for analytics and personalization').should('not.exist')
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('true')
    })
  })

  it('Does not ask when the country cannot be determined', () => {
    cy.intercept('GET', '/api/geo/country', { body: { country: null } }).as('geoUnknown')
    cy.mount(<CookieBanner />)
    cy.wait('@geoUnknown')
    cy.wait('@geoUnknown')
    cy.contains('We use cookies for analytics and personalization').should('not.exist')
    cy.get('@gtagStub').should('not.have.been.called')
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq(null)
    })
  })

  it('Does not ask when the country lookup fails', () => {
    cy.intercept('GET', '/api/geo/country', { statusCode: 500, body: {} }).as('geoFail')
    cy.mount(<CookieBanner />)
    cy.wait('@geoFail')
    cy.wait('@geoFail')
    cy.contains('We use cookies for analytics and personalization').should('not.exist')
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq(null)
    })
  })

  it('Grants US consent even if gtag has not loaded', () => {
    cy.intercept('GET', '/api/geo/country', { body: { country: 'US' } }).as('geoCountryUS')
    cy.window().then((win: any) => {
      delete win.gtag
    })
    cy.mount(<CookieBanner />)
    cy.wait('@geoCountryUS')
    cy.contains('We use cookies for analytics and personalization').should('not.exist')
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('true')
    })
  })

  it('Ignores a corrupt stored value and still skips the banner for US', () => {
    cy.intercept('GET', '/api/geo/country', { body: { country: 'US' } }).as('geoCountryUS')
    cy.window().then((win) => {
      win.localStorage.setItem('cookie_consent', 'null')
    })
    cy.mount(<CookieBanner />)
    cy.wait('@geoCountryUS')
    cy.contains('We use cookies for analytics and personalization').should('not.exist')
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('true')
    })
  })

  it('Updates localStorage and calls gtag when Accept is clicked', () => {
    cy.mount(<CookieBanner />)
    cy.contains('button', 'Accept').click()
    cy.get('@gtagStub').should('have.been.calledWith', 'consent', 'update', {
      analytics_storage: 'granted',
    })
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('true')
    })
  })

  it('Updates localStorage and calls gtag when Decline is clicked', () => {
    cy.mount(<CookieBanner />)
    cy.contains('button', 'Decline').click()
    cy.get('@gtagStub').should('have.been.calledWith', 'consent', 'update', {
      analytics_storage: 'denied',
    })
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('false')
    })
  })

  it('Links to the privacy policy', () => {
    cy.mount(<CookieBanner />)
    cy.contains('a', 'Privacy Policy').should('have.attr', 'href', '/privacy-policy')
  })

  it('Dismisses and declines when the X button is clicked', () => {
    cy.mount(<CookieBanner />)
    cy.get('[aria-label="Close"]').click()
    cy.get('@gtagStub').should('have.been.calledWith', 'consent', 'update', {
      analytics_storage: 'denied',
    })
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('false')
    })
  })
})
