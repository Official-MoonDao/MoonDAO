import TestnetProviders from '@/cypress/mock/TestnetProviders'
import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5Directory from 'const/abis/JBV5Directory.json'
import JBV5Tokens from 'const/abis/JBV5Tokens.json'
import {
  JBV5_CONTROLLER_ADDRESS,
  JBV5_DIRECTORY_ADDRESS,
  JBV5_TOKENS_ADDRESS,
} from 'const/config'
import { getContract } from 'thirdweb'
import useJBProjectData from '@/lib/juicebox/useJBProjectData'
import { serverClient } from '@/lib/thirdweb/client'

// Wrapper that mounts useJBProjectData with the directory contract wired up,
// so we can exercise the `getProjectDirectoryData` effect (the one that calls
// `primaryTerminalOf` in a loop).
const ProbeWrapper = () => {
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

  const data = useJBProjectData({
    // Use a project ID that almost certainly does not exist on the test
    // network so `primaryTerminalOf` resolves to the zero address (the
    // condition that exposes the buggy retry loop).
    projectId: 99999999,
    jbControllerContract,
    jbDirectoryContract,
    jbTokensContract,
    // Force the directory effect to run by leaving `_primaryTerminalAddress`
    // undefined (the effect short-circuits when a server-resolved address is
    // already provided).
    _primaryTerminalAddress: undefined,
    // Pre-populate the token so the unrelated `getProjectToken` effect
    // short-circuits and doesn't add noise.
    _token: {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Test',
      tokenSymbol: 'TEST',
      tokenSupply: '0',
    },
    stage: 1,
  })

  return (
    <div>
      <div data-testid="primary-terminal">{data.primaryTerminalAddress}</div>
    </div>
  )
}

describe('useJBProjectData getProjectDirectoryData effect', () => {
  beforeEach(() => {
    cy.mountNextRouter('/')
    // Quiet down the unrelated network noise from sibling effects.
    cy.intercept('GET', '**/api/juicebox/query**', {
      body: { projects: { items: [] } },
    })
    cy.intercept('POST', '**/api/juicebox/query**', {
      body: { projects: { items: [] } },
    })
  })

  it('does not infinite-loop when primaryTerminalOf cannot be resolved', () => {
    // The buggy version of `getProjectDirectoryData` had two separate defects
    // that combined into an infinite retry loop:
    //   1. The retry budget (`attempt`/`maxAttempts`) was deleted in a refactor
    //      but the warn log inside the loop still references those names →
    //      every iteration throws a `ReferenceError` that the catch swallows.
    //   2. The outer `primaryTerminal` sentinel is never re-assigned, so the
    //      `while (primaryTerminal === ZERO_ADDRESS …)` condition stays true
    //      forever.
    //
    // Net effect: every time the contract read returns the zero address (the
    // common case during a brief RPC hiccup, while a mission is still being
    // deployed, or in this test environment where the RPC stub returns zero),
    // the hook spins forever.  We detect that here by counting the JSON-RPC
    // `eth_call` requests the hook fires off.  A bounded retry loop (or a
    // single shot) will stay under ~10; an unbounded loop blows past it
    // within milliseconds.
    // Watch for the "Error getting primary terminal" error log emitted by
    // the catch branch of the retry loop.  When the loop is bounded the log
    // can fire at most a handful of times (one per attempt); when it is
    // unbounded the log fires non-stop.
    let directoryErrorLogCount = 0
    const originalConsoleError = window.console.error
    cy.stub(window.console, 'error').callsFake((...args: any[]) => {
      const first = args[0]
      if (
        typeof first === 'string' &&
        first.includes('Error getting primary terminal')
      ) {
        directoryErrorLogCount += 1
      }
      return originalConsoleError.apply(window.console, args)
    })

    // Sanity tracker: the hook must actually issue at least one RPC for the
    // assertion below to be meaningful.  Anything POSTed with `eth_call` in
    // the body counts.
    let ethCallCount = 0
    cy.intercept('POST', '**', (req) => {
      const body = req.body
      const stringified =
        typeof body === 'string' ? body : JSON.stringify(body || '')
      if (stringified.includes('"eth_call"')) {
        ethCallCount += 1
      }
    })

    cy.mount(
      <TestnetProviders>
        <ProbeWrapper />
      </TestnetProviders>
    )

    // Give the hook ample time to settle.  A correct retry loop should have
    // exhausted its attempts well within 3 seconds.  An infinite loop will
    // emit dozens of eth_calls in that window.
    cy.wait(3000)

    cy.then(() => {
      cy.task(
        'log',
        `[probe] eth_call count: ${ethCallCount}, ` +
          `directoryError log count: ${directoryErrorLogCount}`
      )
      expect(
        directoryErrorLogCount,
        `getProjectDirectoryData logged "Error getting primary terminal" ` +
          `${directoryErrorLogCount} times in 3s — the retry loop is unbounded.`
      ).to.be.lessThan(20)
    })
  })
})
