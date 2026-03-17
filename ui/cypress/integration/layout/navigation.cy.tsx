import * as thirdwebReact from 'thirdweb/react'
import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { ProjectsNavDropdown } from '@/components/layout/Sidebar/ProjectsNavDropdown'
import { TeamsNavDropdown } from '@/components/layout/Sidebar/TeamsNavDropdown'
import useNavigation from '@/lib/navigation/useNavigation'
import * as useProjectWearerModule from '@/lib/hats/useProjectWearer'
import * as useTeamWearerModule from '@/lib/hats/useTeamWearer'
import * as useContractModule from '@/lib/thirdweb/hooks/useContract'

function restoreIfStubbed(fn: any) {
  if (fn && typeof fn.restore === 'function') {
    fn.restore()
  }
}

function NavigationHarness({ citizen }: { citizen: any }) {
  const navigation = useNavigation(citizen)
  const citizensItem = navigation.find((item) => item.name === 'Citizens')

  return (
    <div>
      <div data-cy="citizens-label">{citizensItem?.name}</div>
      {citizensItem?.children?.map((child: any) => (
        <div key={child.href} data-cy="citizens-child">
          {child.name}:{child.href}
        </div>
      ))}
    </div>
  )
}

describe('navigation updates', () => {
  beforeEach(() => {
    cy.mountNextRouter('/dashboard')

    restoreIfStubbed((thirdwebReact as any).useActiveAccount)
    restoreIfStubbed((useContractModule as any).default)
    restoreIfStubbed(useTeamWearerModule.useTeamWearer)
    restoreIfStubbed(useProjectWearerModule.useProjectWearer)
  })

  it('renames the citizenship menu to Citizens and adds the map link', () => {
    cy.mount(
      <NavigationHarness
        citizen={{ metadata: { name: 'Alice', id: 1 } }}
      />
    )

    cy.get('[data-cy="citizens-label"]').should('have.text', 'Citizens')
    cy.contains('[data-cy="citizens-child"]', 'Map:/map').should('be.visible')
  })

  it('shows the teams fallback instead of a stuck loading state', () => {
    cy.stub(thirdwebReact, 'useActiveAccount').returns({
      address: '0x123',
    } as any)
    cy.stub(useContractModule, 'default').returns(undefined as any)
    cy.stub(useTeamWearerModule, 'useTeamWearer').returns({
      userTeams: [],
      isLoading: false,
    } as any)

    cy.mount(
      <TestnetProviders>
        <TeamsNavDropdown variant="desktop" />
      </TestnetProviders>
    )

    cy.contains('Loading your teams...').should('not.exist')
    cy.contains('No teams yet — create one').should('be.visible')
  })

  it('shows the projects fallback instead of a stuck loading state', () => {
    cy.stub(thirdwebReact, 'useActiveAccount').returns({
      address: '0x123',
    } as any)
    cy.stub(useContractModule, 'default').returns(undefined as any)
    cy.stub(useProjectWearerModule, 'useProjectWearer').returns({
      userProjects: [],
      isLoading: false,
    } as any)

    cy.mount(
      <TestnetProviders>
        <ProjectsNavDropdown variant="desktop" />
      </TestnetProviders>
    )

    cy.contains('Loading your projects...').should('not.exist')
    cy.contains('No projects yet — propose one').should('be.visible')
  })
})
