import { ethers } from 'ethers'

function selector(signature: string): string {
  return ethers.utils.id(signature).slice(0, 10).toLowerCase()
}

const SEL = {
  deadline: selector('deadline()'),
  refundPeriod: selector('refundPeriod()'),
  stage: selector('stage(uint256)'),
  uriOf: selector('uriOf(uint256)'),
  missionIdToPayHook: selector('missionIdToPayHook(uint256)'),
  tokenOf: selector('tokenOf(uint256)'),
  primaryTerminalOf: selector('primaryTerminalOf(uint256,address)'),
  currentRulesetOf: selector('currentRulesetOf(uint256)'),
}

function paddedUint(value: number | bigint): string {
  return '0x' + BigInt(value).toString(16).padStart(64, '0')
}

const MOCK_ADDR =
  '0x' + '1234567890123456789012345678901234567890'.slice(2).padStart(64, '0')

export type MissionRpcMockOptions = {
  stage?: number
  deadlineSec?: number
  refundPeriodSec?: number
}

function ethCallResult(data: string, opts: MissionRpcMockOptions): string {
  const d = (data || '').toLowerCase()
  if (d.startsWith(SEL.deadline)) {
    return paddedUint(opts.deadlineSec ?? Math.floor(Date.now() / 1000))
  }
  if (d.startsWith(SEL.refundPeriod)) {
    return paddedUint(opts.refundPeriodSec ?? 86400)
  }
  if (d.startsWith(SEL.stage)) {
    return paddedUint(opts.stage ?? 1)
  }
  if (d.startsWith(SEL.uriOf)) {
    return paddedUint(0)
  }
  if (
    d.startsWith(SEL.missionIdToPayHook) ||
    d.startsWith(SEL.tokenOf) ||
    d.startsWith(SEL.primaryTerminalOf) ||
    d.startsWith(SEL.currentRulesetOf)
  ) {
    return MOCK_ADDR
  }
  return MOCK_ADDR
}

function replyJsonRpc(id: number | string | undefined, result: string) {
  return { jsonrpc: '2.0' as const, id: id ?? 1, result }
}

function handleRpcItem(item: any, opts: MissionRpcMockOptions) {
  if (!item || typeof item !== 'object') return null
  if (item.method === 'eth_getBalance') {
    return replyJsonRpc(item.id, '0x0')
  }
  if (item.method === 'eth_call') {
    const data = item.params?.[0]?.data || ''
    return replyJsonRpc(item.id, ethCallResult(data, opts))
  }
  return null
}

/**
 * Stable thirdweb JSON-RPC mocks for mission contract reads (supports batched requests).
 */
export function interceptMissionRpc(opts: MissionRpcMockOptions = {}) {
  cy.intercept('POST', '**', (req) => {
    const body = req.body
    if (!body) return

    if (Array.isArray(body)) {
      const responses = body.map(
        (item) => handleRpcItem(item, opts) ?? replyJsonRpc(item?.id, '0x0'),
      )
      req.reply({ statusCode: 200, body: responses })
      return
    }

    const response = handleRpcItem(body, opts)
    if (response) {
      req.reply({ statusCode: 200, body: response })
    }
  }).as('missionRpc')
}

export function interceptMissionTableland() {
  cy.intercept('POST', '**/tableland**', {
    statusCode: 200,
    body: [
      {
        id: 1,
        teamId: 1,
        projectId: 1,
        fundingGoal: 1000000000000000000,
      },
    ],
  }).as('missionTableland')
}
