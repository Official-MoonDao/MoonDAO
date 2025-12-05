import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { ZERO_ADDRESS } from 'thirdweb'
import * as thirdweb from 'thirdweb'
import { fetchTimeData, fetchMissionContracts } from '@/lib/mission/fetchMissionServerData'

describe('fetchMissionServerData', () => {
  beforeEach(() => {
    // Restore any previous stubs
    if ((thirdweb as any).readContract?.restore) {
      ;(thirdweb as any).readContract.restore()
    }

    // Mock tableland query - intercept the actual HTTP call
    cy.intercept('POST', '**/tableland**', {
      body: [
        {
          id: 1,
          teamId: 1,
          projectId: 1,
          fundingGoal: 1000000000000000000,
        },
      ],
    }).as('tablelandQuery')
  })

  it('fetchTimeData returns deadline and refundPeriod', () => {
    const payHookAddress = '0x1234567890123456789012345678901234567890'
    
    cy.wrap(null).then(async () => {
      const timeData = await fetchTimeData(payHookAddress, CYPRESS_CHAIN_V5)
      expect(timeData).to.have.property('deadline')
      expect(timeData).to.have.property('refundPeriod')
      if (timeData.deadline !== undefined) {
        expect(timeData.deadline).to.be.a('number')
      }
      if (timeData.refundPeriod !== undefined) {
        expect(timeData.refundPeriod).to.be.a('number')
      }
    })
  })

  it('fetchTimeData handles missing/invalid addresses gracefully', () => {
    cy.wrap(null).then(async () => {
      const timeData = await fetchTimeData(ZERO_ADDRESS, CYPRESS_CHAIN_V5)
      expect(timeData.deadline).to.be.undefined
      expect(timeData.refundPeriod).to.be.undefined
    })
  })

  it('fetchMissionContracts returns contract data', () => {
    const projectId = 1
    const missionId = 1
    
    cy.wrap(null).then(async () => {
      const contractData = await fetchMissionContracts(projectId, missionId, CYPRESS_CHAIN_V5)
      expect(contractData).to.have.property('stage')
      expect(contractData).to.have.property('tokenAddress')
      expect(contractData).to.have.property('primaryTerminalAddress')
      expect(contractData).to.have.property('metadataURI')
      expect(contractData).to.have.property('payHookAddress')
      expect(contractData).to.have.property('ruleset')
      expect(contractData.stage).to.be.a('bigint')
      expect(contractData.tokenAddress).to.be.a('string')
      expect(contractData.tokenAddress).to.match(/^0x[a-fA-F0-9]{40}$/)
      expect(contractData.primaryTerminalAddress).to.be.a('string')
      expect(contractData.primaryTerminalAddress).to.match(/^0x[a-fA-F0-9]{40}$/)
      expect(contractData.metadataURI).to.be.a('string')
      expect(contractData.payHookAddress).to.be.a('string')
      expect(contractData.payHookAddress).to.match(/^0x[a-fA-F0-9]{40}$/)
      expect(contractData.ruleset).to.be.an('array')
    })
  })
})
