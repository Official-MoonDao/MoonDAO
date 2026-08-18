import ContentLayout from '@/components/layout/ContentLayout'
import ProfileHeaderFrame from '@/components/layout/ProfileHeaderFrame'
import StandardDetailCard from '@/components/layout/StandardDetailCard'

const LONG_NAME = 'BELLA.INTERSTELLAR'
const BIO =
  'Humanitarian captain turned founder of the Space Debris DAO, an ESA BIC space sustainability startup. Trained legislators, builds civic participation, and spreads the overview effect across domains.'

const viewports: Cypress.ViewportPreset[] = ['iphone-x', 'ipad-2', 'macbook-15']

function assertFitsBox(el: HTMLElement, label: string) {
  // GoodTimes display glyphs can ink a few pixels past the em box.
  expect(el.scrollWidth, label).to.be.at.most(el.clientWidth + 8)
}

function mountProfileHeader() {
  cy.mount(
    <div className="w-full max-w-[100vw] overflow-x-hidden px-4">
      <ContentLayout
        mode="compact"
        branded={false}
        isProfile
        description={
          <ProfileHeaderFrame
            id="citizenheader-container"
            image={
              <div className="w-[200px] h-[200px] rounded-2xl border-4 border-slate-500/50 bg-slate-700" />
            }
          >
            <div className="flex flex-col gap-4 w-full min-w-0">
              <h1
                data-testid="profile-name"
                className="font-GoodTimes text-white text-xl sm:text-2xl lg:text-4xl font-bold mb-3 w-full max-w-full break-words [overflow-wrap:anywhere]"
              >
                {LONG_NAME}
              </h1>
              <p
                data-testid="profile-bio"
                className="text-slate-300 text-base leading-relaxed mb-4 w-full max-w-full break-words"
              >
                {BIO}
              </p>
            </div>
          </ProfileHeaderFrame>
        }
      />
    </div>
  )
}

describe('<ProfileHeaderFrame />', () => {
  viewports.forEach((viewport) => {
    it(`keeps long names and bios inside the card on ${viewport}`, () => {
      cy.viewport(viewport)
      mountProfileHeader()

      cy.get('#citizenheader-container').should('be.visible')
      cy.get('[data-testid="profile-name"]')
        .should('contain', LONG_NAME)
        .and(($el) => {
          assertFitsBox($el[0] as HTMLElement, 'name does not overflow its box')
        })
      cy.get('[data-testid="profile-bio"]')
        .should('contain', 'Humanitarian captain')
        .and('contain', 'overview effect')
        .and(($el) => {
          assertFitsBox($el[0] as HTMLElement, 'bio does not overflow its box')
        })

      cy.get('#citizenheader-container').then(($card) => {
        const card = $card[0].getBoundingClientRect()
        cy.get('[data-testid="profile-name"]').then(($name) => {
          const name = $name[0].getBoundingClientRect()
          expect(name.left, 'name not clipped on the left').to.be.at.least(card.left - 1)
          expect(name.right, 'name not clipped on the right').to.be.at.most(card.right + 1)
        })
        cy.get('[data-testid="profile-bio"]').then(($bio) => {
          const bio = $bio[0].getBoundingClientRect()
          expect(bio.left, 'bio not clipped on the left').to.be.at.least(card.left - 1)
          expect(bio.right, 'bio not clipped on the right').to.be.at.most(card.right + 1)
        })
      })

      cy.get('#citizenheader-container').then(($card) => {
        assertFitsBox($card[0] as HTMLElement, 'card does not overflow horizontally')
      })
    })
  })

  it('does not use a 350px min-width spacer in compact profile layout', () => {
    cy.viewport('iphone-x')
    mountProfileHeader()
    cy.get('#image').should('not.have.class', 'min-w-[350px]')
    cy.get('#title-wrapper').should('have.class', 'min-w-0')
  })
})

describe('<StandardDetailCard /> profile listings', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  viewports.forEach((viewport) => {
    it(`wraps long GoodTimes titles on ${viewport}`, () => {
      cy.viewport(viewport)
      cy.mount(
        <div className="w-full max-w-[100vw] px-4">
          <StandardDetailCard title={LONG_NAME} paragraph={BIO} />
        </div>
      )

      cy.contains('h1', LONG_NAME).should(($el) => {
        assertFitsBox($el[0] as HTMLElement, 'listing title does not overflow')
      })
    })
  })
})
