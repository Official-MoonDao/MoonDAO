import { ScaleIcon } from '@heroicons/react/24/outline'
import FeatureCard from '@/components/mooney/FeatureCard'

describe('<FeatureCard />', () => {
  const mockIcon = (
    <div className="bg-blue-500/20 rounded-full w-12 h-12 flex items-center justify-center">
      <ScaleIcon className="w-6 h-6 text-blue-400" />
    </div>
  )
  beforeEach(() => {
    cy.mountNextRouter('/')
  })

  it('renders with required props', () => {
    cy.mount(<FeatureCard icon={mockIcon} title="Test Feature" description="Test description" />)

    cy.contains('Test Feature').should('exist')
    cy.contains('Test description').should('exist')
  })

  it('displays badges when provided', () => {
    cy.mount(
      <FeatureCard
        icon={mockIcon}
        title="Test Feature"
        description="Test description"
        badges={['ETH', 'ARB']}
      />
    )

    cy.contains('ETH').should('exist')
    cy.contains('ARB').should('exist')
  })

  it('applies custom className', () => {
    cy.mount(
      <FeatureCard
        icon={mockIcon}
        title="Test Feature"
        description="Test description"
        className="custom-class"
      />
    )

    cy.get('.custom-class').should('exist')
  })
})
