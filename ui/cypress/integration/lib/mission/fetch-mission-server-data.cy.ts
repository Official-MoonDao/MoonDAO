import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { ZERO_ADDRESS } from 'thirdweb'
import { fetchTimeData, fetchMissionContracts } from '@/lib/mission/fetchMissionServerData'

describe('fetchMissionServerData', () => {
  beforeEach(() => {
    cy.intercept('POST', '**', (req) => {
      if (req.body && req.body.method === 'getTableName') {
        req.reply({ result: 'mission_table' })
      } else if (req.body && req.body.method === 'deadline') {
        req.reply({ result: '0x' + Math.floor(Date.now() / 1000).toString(16) })
      } else if (req.body && req.body.method === 'refundPeriod') {
        req.reply({ result: '0x15180' }) // 86400 in hex (1 day)
      } else if (req.body && req.body.method === 'stage') {
        req.reply({ result: '0x1' })
      } else if (req.body && req.body.method === 'missionIdToPayHook') {
        req.reply({ result: '0x1234567890123456789012345678901234567890' })
      } else if (req.body && req.body.method === 'missionIdToToken') {
        req.reply({ result: '0x1234567890123456789012345678901234567890' })
      }
    }).as('contractCalls')

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

  it('fetchTimeData returns deadline and refundPeriod', async () => {
    const payHookAddress = '0x1234567890123456789012345678901234567890'
    const timeData = await fetchTimeData(payHookAddress, CYPRESS_CHAIN_V5)
    expect(timeData).to.have.property('deadline')
    expect(timeData).to.have.property('refundPeriod')
  })

  it('fetchTimeData handles missing/invalid addresses gracefully', async () => {
    const timeData = await fetchTimeData(ZERO_ADDRESS, CYPRESS_CHAIN_V5)
    expect(timeData.deadline).to.be.undefined
    expect(timeData.refundPeriod).to.be.undefined
  })

  it('fetchMissionContracts returns contract data', async () => {
    const projectId = 1
    const missionId = 1
    const contractData = await fetchMissionContracts(projectId, missionId, CYPRESS_CHAIN_V5)
    expect(contractData).to.have.property('stage')
    expect(contractData).to.have.property('tokenAddress')
    expect(contractData).to.have.property('primaryTerminalAddress')
  })
})
