import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import { ZERO_ADDRESS } from 'thirdweb'
import { fetchTimeData, fetchMissionContracts } from '@/lib/mission/fetchMissionServerData'

describe('fetchMissionServerData', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/rpc/**', (req) => {
      if (req.body && req.body.method === 'eth_call') {
        const data = req.body.params?.[0]?.data || ''

        if (data.includes('deadline') || data.startsWith('0x26d4ce')) {
          // deadline() method
          req.reply({
            result:
              '0x' +
              Math.floor(Date.now() / 1000)
                .toString(16)
                .padStart(64, '0'),
          })
        } else if (data.includes('refundPeriod') || data.startsWith('0x')) {
          // refundPeriod() method or other calls
          req.reply({ result: '0x' + '15180'.padStart(64, '0') }) // 86400 in hex (1 day)
        } else {
          // Default response
          req.reply({ result: '0x' + '1'.padStart(64, '0') })
        }
      } else if (req.body && req.body.method === 'eth_getBalance') {
        req.reply({ result: '0x0' })
      }
    }).as('rpcCalls')

    cy.intercept('POST', '**/thirdweb.com/**', (req) => {
      if (req.body && req.body.method === 'eth_call') {
        const data = req.body.params?.[0]?.data || ''
        if (data.includes('deadline') || data.startsWith('0x26d4ce')) {
          req.reply({
            result:
              '0x' +
              Math.floor(Date.now() / 1000)
                .toString(16)
                .padStart(64, '0'),
          })
        } else if (data.includes('refundPeriod')) {
          req.reply({ result: '0x' + '15180'.padStart(64, '0') })
        } else if (
          data.includes('uriOf') ||
          data.includes('tokenOf') ||
          data.includes('primaryTerminalOf')
        ) {
          // Return empty string for URI calls or address for address calls
          req.reply({ result: '0x' + '0'.padStart(64, '0') })
        } else {
          req.reply({ result: '0x' + '1'.padStart(64, '0') })
        }
      } else if (req.body && req.body.method === 'eth_getBalance') {
        req.reply({ result: '0x0' })
      }
    }).as('thirdwebRpc')

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
