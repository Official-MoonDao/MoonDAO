import CookieBanner from '@/components/layout/CookieBanner'

describe('CookieBanner', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win) => {
      win.gtag = cy.stub().as('gtagStub')
    })
  })

  it('Renders when cookie consent is null', () => {
    cy.mount(<CookieBanner />)
    cy.contains('We use cookies on our site').should('be.visible')
  })

  it('Updates localStorage and calls gtag when Allow Cookies is clicked', () => {
    cy.mount(<CookieBanner />)
    cy.contains('Allow Cookies').click()
    cy.get('@gtagStub').should('have.been.calledWith', 'consent', 'update', {
      analytics_storage: 'granted',
    })
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('true')
    })
  })

  it('Updates localStorage and calls gtag when Decline is clicked', () => {
    cy.mount(<CookieBanner />)
    cy.contains('Decline').click()
    cy.get('@gtagStub').should('have.been.calledWith', 'consent', 'update', {
      analytics_storage: 'denied',
    })
    cy.should(() => {
      expect(localStorage.getItem('cookie_consent')).to.eq('false')
    })
  })

  it('Links to the privacy policy', () => {
    cy.mount(<CookieBanner />)
    cy.contains('We use cookies on our site').should(
      'have.attr',
      'href',
      'https://docs.moondao.com/Legal/Website-Privacy-Policy'
    )
  })
})
