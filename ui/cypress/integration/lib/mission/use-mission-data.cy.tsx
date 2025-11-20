import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import {
  MISSION_CREATOR_ADDRESSES,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
} from 'const/config'
import { getContract } from 'thirdweb'
import useMissionData from '@/lib/mission/useMissionData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

const MissionDataWrapper = ({ mission, props }: { mission: any; props: any }) => {
  const chainSlug = getChainSlug(CYPRESS_CHAIN_V5)

  const missionTableContract = getContract({
    client: serverClient,
    address: '0x1234567890123456789012345678901234567890',
    abi: [] as any,
    chain: CYPRESS_CHAIN_V5,
  })

  const missionCreatorContract = getContract({
    client: serverClient,
    address: MISSION_CREATOR_ADDRESSES[chainSlug],
    abi: MissionCreator.abi as any,
    chain: CYPRESS_CHAIN_V5,
  })

  const jbControllerContract = getContract({
    client: serverClient,
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi as any,
    chain: CYPRESS_CHAIN_V5,
  })

  const jbDirectoryContract = getContract({
    client: serverClient,
    address: JBV5_DIRECTORY_ADDRESS,
    abi: JBV5Directory.abi as any,
    chain: CYPRESS_CHAIN_V5,
  })

  const jbTokensContract = getContract({
    client: serverClient,
    address: JBV5_TOKENS_ADDRESS,
    abi: JBV5Tokens.abi as any,
    chain: CYPRESS_CHAIN_V5,
  })

  const data = useMissionData({
    mission,
    missionTableContract,
    missionCreatorContract,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    ...props,
  })

  return (
    <div>
      <div data-testid="stage">{data.stage}</div>
      <div data-testid="funding-goal">{data.fundingGoal || 'N/A'}</div>
      <div data-testid="deadline">{data.deadline || 'N/A'}</div>
      <button data-testid="refresh-stage-btn" onClick={() => data.refreshStage()}>
        Refresh Stage
      </button>
      <button data-testid="refresh-backers-btn" onClick={() => data.refreshBackers()}>
        Refresh Backers
      </button>
    </div>
  )
}

describe('useMissionData', () => {
  const mockMission = {
    id: 1,
    projectId: 1,
  }

  const mockProps = {
    _stage: 1,
    _deadline: Date.now() + 86400000,
    _refundPeriod: 86400000,
    _primaryTerminalAddress: '0x1234567890123456789012345678901234567890',
    _token: {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
    },
    _fundingGoal: 1000000000000000000,
    _ruleset: [{ weight: 1000 }, { reservedPercent: 0 }],
    _backers: [],
    projectMetadata: {
      name: 'Test Mission',
      description: 'Test Description',
    },
  }

  beforeEach(() => {
    cy.mountNextRouter('/')
    cy.intercept('GET', '**/api/mission/backers**', { body: { backers: [] } }).as('backersApi')
    cy.intercept('GET', '**/api/juicebox/query**', { body: { projects: { items: [] } } }).as('juiceboxQuery')
    cy.intercept('GET', '**', (req) => {
      if (req.url.includes('ipfs://') || req.url.includes('ipfs.io')) {
        req.reply({ body: { name: 'Test Mission', description: 'Test Description' } })
      }
    })
    cy.intercept('POST', '**', (req) => {
      if (req.body && typeof req.body === 'object') {
        if (req.body.method === 'stage') {
          req.reply({ result: '0x1' })
        } else if (req.body.method === 'uriOf') {
          req.reply({ result: 'ipfs://test-metadata-uri' })
        } else if (req.body.method === 'currentRulesetOf') {
          req.reply({ result: [{ weight: 1000 }, { reservedPercent: 0 }] })
        } else if (req.body.method === 'tokenOf') {
          req.reply({ result: '0x1234567890123456789012345678901234567890' })
        } else if (req.body.method === 'primaryTerminalOf') {
          req.reply({ result: '0x1234567890123456789012345678901234567890' })
        } else if (req.body.method === 'missionIdToPayHook') {
          req.reply({ result: '0x1234567890123456789012345678901234567890' })
        } else if (req.body.method === 'deadline' || req.body.method === 'refundPeriod') {
          req.reply({ result: '0x' + Math.floor(Date.now() / 1000).toString(16) })
        }
      }
    })
  })

  it('initializes with provided props', () => {
    cy.mount(
      <TestnetProviders>
        <MissionDataWrapper mission={mockMission} props={mockProps} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]').should('contain', '1')
    cy.get('[data-testid="funding-goal"]').should('not.contain', 'N/A')
  })

  it('provides refreshStage function', () => {
    cy.mount(
      <TestnetProviders>
        <MissionDataWrapper mission={mockMission} props={mockProps} />
      </TestnetProviders>
    )

    cy.get('[data-testid="refresh-stage-btn"]').should('exist')
    cy.get('[data-testid="stage"]').should('exist')
    cy.get('[data-testid="refresh-stage-btn"]').click()
    cy.get('[data-testid="stage"]').should('exist')
  })

  it('provides refreshBackers function', () => {
    cy.mount(
      <TestnetProviders>
        <MissionDataWrapper mission={mockMission} props={mockProps} />
      </TestnetProviders>
    )

    cy.get('[data-testid="refresh-backers-btn"]').should('exist')
    cy.get('[data-testid="stage"]').should('exist')
    cy.get('[data-testid="refresh-backers-btn"]').click()
    cy.wait('@backersApi')
  })

  it('returns expected data structure', () => {
    cy.mount(
      <TestnetProviders>
        <MissionDataWrapper mission={mockMission} props={mockProps} />
      </TestnetProviders>
    )

    cy.get('[data-testid="stage"]').should('exist')
    cy.get('[data-testid="funding-goal"]').should('exist')
    cy.get('[data-testid="deadline"]').should('exist')
  })
})
