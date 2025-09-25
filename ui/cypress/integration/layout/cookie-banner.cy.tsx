import CookieBanner from '@/components/layout/CookieBanner'

describe('<CookieBanner />', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win: any) => {
      win.gtag = cy.stub().as('gtagStub')
    })
  })

  it('Renders when cookie consent is null', () => {
    cy.mount(<CookieBanner />)
    cy.contains('We use cookies to enhance your experience').should(
      'be.visible'
    )
  })

  it('Updates localStorage and calls gtag when Allow Cookies is clicked', () => {
    cy.mount(<CookieBanner />)
    cy.contains('button', 'Allow Cookies').click()
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
    cy.contains('a', 'Privacy Policy').should(
      'have.attr',
      'href',
      '/privacy-policy'
    )
  })
})
