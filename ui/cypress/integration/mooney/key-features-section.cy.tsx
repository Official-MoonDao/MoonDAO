import TestnetProviders from '@/cypress/mock/TestnetProviders'
import KeyFeaturesSection from '@/components/mooney/KeyFeaturesSection'
import { ScaleIcon, ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

describe('<KeyFeaturesSection />', () => {
  const mockFeatures = [
    {
      icon: (
        <div className="bg-blue-500/20 rounded-full w-12 h-12 flex items-center justify-center">
          <ScaleIcon className="w-6 h-6 text-blue-400" />
        </div>
      ),
      title: 'Quadratic Voting',
      description: 'Test description',
    },
    {
      icon: (
        <div className="bg-purple-500/20 rounded-full w-12 h-12 flex items-center justify-center">
          <ShieldCheckIcon className="w-6 h-6 text-purple-400" />
        </div>
      ),
      title: 'Fixed Supply',
      description: 'Test description',
    },
    {
      icon: (
        <div className="bg-green-500/20 rounded-full w-12 h-12 flex items-center justify-center">
          <GlobeAltIcon className="w-6 h-6 text-green-400" />
        </div>
      ),
      title: 'Multi-Chain',
      description: 'Test description',
      badges: ['ETH', 'ARB'],
    },
  ]

  const mockSteps = [
    { number: 1, label: 'Get MOONEY', color: '#3B82F6' },
    { number: 2, label: 'Lock for vMOONEY', color: '#8B5CF6' },
    { number: 3, label: 'Vote on Proposals', color: '#10B981' },
    { number: 4, label: 'Shape Mission', color: '#F59E0B' },
  ]

  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders features section', () => {
    cy.mount(
      <TestnetProviders>
        <KeyFeaturesSection
          features={mockFeatures}
          governanceSteps={mockSteps}
          formula="Voting Power = √(vMOONEY)"
          formulaDescription="Test description"
        />
      </TestnetProviders>
    )

    cy.contains('Key Features').should('exist')
  })

  it('displays all features', () => {
    cy.mount(
      <TestnetProviders>
        <KeyFeaturesSection
          features={mockFeatures}
          governanceSteps={mockSteps}
          formula="Voting Power = √(vMOONEY)"
          formulaDescription="Test description"
        />
      </TestnetProviders>
    )

    mockFeatures.forEach((feature) => {
      cy.contains(feature.title).should('exist')
    })
  })

  it('shows governance flow steps', () => {
    cy.mount(
      <TestnetProviders>
        <KeyFeaturesSection
          features={mockFeatures}
          governanceSteps={mockSteps}
          formula="Voting Power = √(vMOONEY)"
          formulaDescription="Test description"
        />
      </TestnetProviders>
    )

    mockSteps.forEach((step) => {
      cy.contains(step.label).should('exist')
    })
  })

  it('displays formula and description', () => {
    cy.mount(
      <TestnetProviders>
        <KeyFeaturesSection
          features={mockFeatures}
          governanceSteps={mockSteps}
          formula="Voting Power = √(vMOONEY)"
          formulaDescription="Test description"
        />
      </TestnetProviders>
    )

    cy.contains('Voting Power = √(vMOONEY)').should('exist')
    cy.contains('Test description').should('exist')
  })
})

