/**
 * Network-level JSON-RPC mock for component tests.
 *
 * In the browser every thirdweb read on our chains goes through
 * `<origin>/api/rpc/<chainId>` (see `lib/rpc/chains.ts`). Component tests run
 * against Cypress's webpack dev server, which has no Next API routes, so any
 * live read fails with "Cannot POST /api/rpc/...". Stubbing thirdweb module
 * exports (cy.stub(thirdweb, 'readContract')) does NOT reliably intercept the
 * app's calls — webpack ESM bindings resolve the original function. The
 * network layer is the one choke point everything shares, so mock there.
 */

const UINT_ONE = '0x' + '1'.padStart(64, '0')

type RpcCall = { jsonrpc: string; id: number; method: string; params: any[] }

/** Per-method result overrides; return undefined to fall through to defaults. */
export type RpcHandler = (method: string, params: any[]) => any

function defaultResult(method: string, blockCounter: { n: number }): any {
  switch (method) {
    case 'eth_chainId':
      return '0xaa36a7' // sepolia
    case 'eth_blockNumber':
      // Increment so block watchers (e.g. waitForReceipt) always see progress.
      blockCounter.n += 1
      return '0x' + blockCounter.n.toString(16)
    case 'eth_gasPrice':
    case 'eth_maxPriorityFeePerGas':
      return '0x3b9aca00'
    case 'eth_getBalance':
      return '0x0'
    case 'eth_call':
      // A single 32-byte word decodes as uint 1 / a low non-zero address —
      // a safe generic answer for simple getters.
      return UINT_ONE
    default:
      return '0x'
  }
}

/**
 * Intercept all `/api/rpc/<chainId>` POSTs (single or batched) and answer
 * deterministically. Pass a handler to override specific methods.
 */
export function interceptRpc(handler?: RpcHandler) {
  const blockCounter = { n: 0 }

  cy.intercept('POST', '**/api/rpc/**', (req) => {
    const answer = (call: RpcCall) => {
      const custom = handler?.(call.method, call.params)
      return {
        jsonrpc: '2.0',
        id: call.id,
        result: custom !== undefined ? custom : defaultResult(call.method, blockCounter),
      }
    }

    const body = req.body
    req.reply(Array.isArray(body) ? body.map(answer) : answer(body))
  }).as('rpc')
}

/** ABI-encode a uint256 as a 32-byte hex word (for eth_call results). */
export function encodeUint(value: bigint | number): string {
  return '0x' + BigInt(value).toString(16).padStart(64, '0')
}

/** Minimal but complete EIP-1559 transaction receipt, viem-parseable. */
export function mockReceipt(transactionHash: string) {
  return {
    transactionHash,
    transactionIndex: '0x0',
    blockHash: '0x' + 'ab'.repeat(32),
    blockNumber: '0x1',
    from: '0x' + '11'.repeat(20),
    to: '0x' + '22'.repeat(20),
    cumulativeGasUsed: '0x5208',
    gasUsed: '0x5208',
    contractAddress: null,
    logs: [],
    logsBloom: '0x' + '00'.repeat(256),
    status: '0x1',
    effectiveGasPrice: '0x3b9aca00',
    type: '0x2',
  }
}
