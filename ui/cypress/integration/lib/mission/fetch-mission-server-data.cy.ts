import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { interceptMissionRpc, interceptMissionTableland } from '@/cypress/mock/missionRpcMock'
import { ZERO_ADDRESS } from 'thirdweb'
import { fetchTimeData, fetchMissionContracts } from '@/lib/mission/fetchMissionServerData'

describe('fetchMissionServerData', () => {
  beforeEach(() => {
    interceptMissionRpc({ stage: 1, refundPeriodSec: 86400 })
    interceptMissionTableland()
  })

  it('fetchTimeData returns deadline and refundPeriod', () => {
    cy.then(async () => {
      const payHookAddress = '0x1234567890123456789012345678901234567890'
      const timeData = await fetchTimeData(payHookAddress, CYPRESS_CHAIN_V5)
      expect(timeData).to.have.property('deadline')
      expect(timeData).to.have.property('refundPeriod')
      expect(timeData.deadline).to.be.a('number')
      expect(timeData.refundPeriod).to.be.a('number')
    })
  })

  it('fetchTimeData handles missing/invalid addresses gracefully', () => {
    cy.then(async () => {
      const timeData = await fetchTimeData(ZERO_ADDRESS, CYPRESS_CHAIN_V5)
      expect(timeData.deadline).to.be.undefined
      expect(timeData.refundPeriod).to.be.undefined
    })
  })

  it('fetchMissionContracts returns contract data', () => {
    cy.then(async () => {
      const projectId = 1
      const missionId = 1
      const contractData = await fetchMissionContracts(projectId, missionId, CYPRESS_CHAIN_V5)
      expect(contractData).to.have.property('stage')
      expect(contractData).to.have.property('tokenAddress')
      expect(contractData).to.have.property('primaryTerminalAddress')
    })
  })
})
