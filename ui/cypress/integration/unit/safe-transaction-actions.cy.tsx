/**
 * Node simulations for the team Safe transaction action logic.
 *
 * These run under mocha (no browser / Electron) via `yarn test:cypress-unit`
 * and exercise the pure decision logic that powers <SafeTransactions />:
 * which of Sign / Execute / Reject is offered for a given pending transaction,
 * plus the labeling helpers. They lock in the reported-bug fix (an owner can
 * sign ANY pending transaction regardless of nonce ordering) and verify the
 * action callbacks are wired to the right Safe methods.
 */
import { ethers } from 'ethers'
import {
  deriveTransactionActions,
  getRecipientAddress,
  getTransactionMethod,
  groupHasRejection,
  groupTransactionsByNonce,
  isEthTransfer,
  isRejectionTransaction,
  isTokenTransfer,
} from '../../../lib/safe/safeTransactionActions'

const ME = '0x1111111111111111111111111111111111111111'
const OTHER_A = '0x2222222222222222222222222222222222222222'
const OTHER_B = '0x3333333333333333333333333333333333333333'

const conf = (owner: string) => ({
  owner,
  signature: '0x' + '0'.repeat(130),
  submissionDate: new Date().toISOString(),
  transactionHash: null,
})

const baseTx = {
  safeTxHash: '0xhash',
  to: '0x526643F69b81B008F46d95CD5ced5eC0edFFDaC6',
  value: '0',
  data: '0xabcdef',
  dataDecoded: { method: 'mintHat', parameters: [] },
  nonce: 1,
  isExecuted: false,
  confirmations: [] as any[],
  confirmationsRequired: 2,
}

// Minimal manual spy (sinon isn't wired into the node unit harness).
function spy() {
  const fn: any = (...args: any[]) => {
    fn.calls.push(args)
    return Promise.resolve('0xresult')
  }
  fn.calls = [] as any[][]
  return fn
}

describe('Safe transaction action gating', () => {
  // -- The reported bug -------------------------------------------------------
  describe('signing is NOT gated on the current nonce (reported bug)', () => {
    it('offers Sign for a future-nonce, partially-signed transaction', () => {
      const tx = {
        ...baseTx,
        nonce: 15,
        confirmations: [conf(OTHER_A)], // signed by someone else, not me
      }
      const s = deriveTransactionActions(tx, {
        threshold: 5,
        currentNonce: 14, // tx nonce (15) is AHEAD of current
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.canSign, 'a future-nonce tx must still be signable').to.equal(
        true
      )
      expect(s.showSignButton).to.equal(true)
      // ...but it must not be executable yet (wrong nonce order).
      expect(s.canExecute).to.equal(false)
      expect(s.showExecuteButton).to.equal(false)
    })

    it('offers Sign for the current-nonce, unsigned transaction too', () => {
      const tx = { ...baseTx, nonce: 14, confirmations: [] }
      const s = deriveTransactionActions(tx, {
        threshold: 5,
        currentNonce: 14,
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.showSignButton).to.equal(true)
      expect(s.showRejectButton).to.equal(true)
    })
  })

  // -- Execute gating ---------------------------------------------------------
  describe('execution is gated on confirmations AND the current nonce', () => {
    it('offers Execute when fully signed at the current nonce', () => {
      const tx = {
        ...baseTx,
        nonce: 20,
        confirmations: [conf(ME), conf(OTHER_A)],
      }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 20,
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.canExecute).to.equal(true)
      expect(s.showExecuteButton).to.equal(true)
      expect(s.showBlockedIndicator).to.equal(false)
    })

    it('does NOT offer Execute when fully signed but the wrong nonce', () => {
      const tx = {
        ...baseTx,
        nonce: 21,
        confirmations: [conf(ME), conf(OTHER_A)],
      }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 20,
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.canExecute).to.equal(false)
      expect(s.showExecuteButton).to.equal(false)
      // Instead, it shows the "blocked by earlier nonce" hint.
      expect(s.showBlockedIndicator).to.equal(true)
    })

    it('does NOT offer Execute when not enough confirmations', () => {
      const tx = { ...baseTx, nonce: 20, confirmations: [conf(ME)] }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 20,
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.canExecute).to.equal(false)
    })
  })

  // -- Signed / reject-after-sign --------------------------------------------
  describe('post-signing state', () => {
    it('shows signed status + reject-after-sign once I have signed', () => {
      const tx = { ...baseTx, nonce: 1, confirmations: [conf(ME)] }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 1,
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.hasSigned).to.equal(true)
      expect(s.showSignedStatus).to.equal(true)
      expect(s.showSignButton, 'no Sign button after I signed').to.equal(false)
      expect(s.showRejectAfterSignButton).to.equal(true)
    })

    it('matches owner address case-insensitively', () => {
      const tx = {
        ...baseTx,
        confirmations: [conf(ME.toUpperCase())],
      }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 1,
        address: ME.toLowerCase(),
        hasRejectionInGroup: false,
      })
      expect(s.hasSigned).to.equal(true)
    })
  })

  // -- Rejection groups -------------------------------------------------------
  describe('rejection-in-group behavior', () => {
    it('replaces normal Sign/Reject with a single rejection-aware Sign', () => {
      const tx = { ...baseTx, nonce: 1, confirmations: [] }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 1,
        address: ME,
        hasRejectionInGroup: true,
      })
      expect(s.showSignWithRejectionButton).to.equal(true)
      expect(s.showSignButton).to.equal(false)
      expect(s.showRejectButton).to.equal(false)
    })
  })

  // -- Executed transactions --------------------------------------------------
  describe('executed transactions offer no actions', () => {
    it('hides every action once executed', () => {
      const tx = {
        ...baseTx,
        nonce: 1,
        isExecuted: true,
        confirmations: [conf(OTHER_A)],
      }
      const s = deriveTransactionActions(tx, {
        threshold: 2,
        currentNonce: 1,
        address: ME,
        hasRejectionInGroup: false,
      })
      expect(s.canSign).to.equal(false)
      expect(s.canExecute).to.equal(false)
      expect(s.showSignButton).to.equal(false)
      expect(s.showExecuteButton).to.equal(false)
    })
  })

  // -- confirmationsRequired fallback ----------------------------------------
  it('falls back to threshold when confirmationsRequired is missing', () => {
    const tx: any = { ...baseTx, confirmationsRequired: undefined }
    const s = deriveTransactionActions(tx, {
      threshold: 3,
      currentNonce: 1,
      address: ME,
      hasRejectionInGroup: false,
    })
    expect(s.requiredConfirmations).to.equal(3)
  })
})

describe('Safe transaction labeling helpers', () => {
  it('labels a plain ETH transfer', () => {
    const tx = {
      ...baseTx,
      data: '0x',
      value: ethers.utils.parseEther('1.5').toString(),
      dataDecoded: null,
    }
    expect(isEthTransfer(tx)).to.equal(true)
    expect(getTransactionMethod(tx)).to.equal('Transfer ETH')
  })

  it('labels a rejection (zero value, empty data)', () => {
    const tx = { ...baseTx, data: '0x', value: '0', dataDecoded: null }
    expect(isRejectionTransaction(tx)).to.equal(true)
    expect(getTransactionMethod(tx)).to.equal('Reject Transaction')
  })

  it('labels a rejection decoded as rejectTransaction', () => {
    const tx = {
      ...baseTx,
      data: '0x',
      value: '0',
      dataDecoded: { method: 'rejectTransaction', parameters: [] },
    }
    expect(isRejectionTransaction(tx)).to.equal(true)
  })

  it('falls back to the decoded method or Unknown Method', () => {
    expect(getTransactionMethod(baseTx)).to.equal('mintHat')
    const unknown = { ...baseTx, dataDecoded: null }
    expect(getTransactionMethod(unknown)).to.equal('Unknown Method')
  })

  it('resolves the ERC-20 recipient from decoded params, not the token contract', () => {
    const recipient = '0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b'
    const tx = {
      ...baseTx,
      to: '0xTokenContract',
      dataDecoded: {
        method: 'transfer',
        parameters: [{ value: recipient }, { value: '1000' }],
      },
    }
    expect(isTokenTransfer(tx)).to.equal(true)
    expect(getRecipientAddress(tx)).to.equal(recipient)
  })

  it('uses tx.to as recipient for non-transfer methods', () => {
    expect(getRecipientAddress(baseTx)).to.equal(baseTx.to)
  })
})

describe('Safe transaction grouping', () => {
  it('groups transactions by nonce', () => {
    const txs = [
      { ...baseTx, safeTxHash: '0xa', nonce: 1 },
      { ...baseTx, safeTxHash: '0xb', nonce: 1 },
      { ...baseTx, safeTxHash: '0xc', nonce: 2 },
    ]
    const groups = groupTransactionsByNonce(txs)
    const byNonce = Object.fromEntries(groups.map((g) => [g.nonce, g]))
    expect(byNonce[1].transactions.length).to.equal(2)
    expect(byNonce[2].transactions.length).to.equal(1)
  })

  it('detects a rejection within a nonce group', () => {
    const withRejection = [
      { ...baseTx, safeTxHash: '0xa', nonce: 1 },
      {
        ...baseTx,
        safeTxHash: '0xb',
        nonce: 1,
        data: '0x',
        value: '0',
        dataDecoded: { method: 'rejectTransaction', parameters: [] },
      },
    ]
    expect(groupHasRejection(withRejection)).to.equal(true)
    expect(groupHasRejection([{ ...baseTx, nonce: 1 }])).to.equal(false)
  })
})

// -- Action wiring ----------------------------------------------------------
// Mirrors exactly how <SafeTransactions /> wires each visible button to a
// SafeData method, proving a click triggers the right on-chain call with the
// transaction's hash.
describe('Safe action wiring (click -> SafeData method)', () => {
  function buildHandlers(safeData: any, setDisclaimerHash: (h: string) => void) {
    return {
      sign: (hash: string) => safeData.signPendingTransaction(hash),
      reject: (hash: string) => safeData.rejectTransaction(hash),
      // Execute opens the disclaimer first; the disclaimer then calls
      // onExecute(hash) === safeData.executeTransaction(hash).
      execute: (hash: string) => setDisclaimerHash(hash),
      confirmExecute: (hash: string) => safeData.executeTransaction(hash),
    }
  }

  it('Sign click confirms the pending transaction', () => {
    const safeData = { signPendingTransaction: spy() }
    const h = buildHandlers(safeData, () => {})
    h.sign('0xhash')
    expect(safeData.signPendingTransaction.calls).to.deep.equal([['0xhash']])
  })

  it('Reject click proposes a rejection for the transaction', () => {
    const safeData = { rejectTransaction: spy() }
    const h = buildHandlers(safeData, () => {})
    h.reject('0xhash')
    expect(safeData.rejectTransaction.calls).to.deep.equal([['0xhash']])
  })

  it('Execute click opens the disclaimer, then executes after confirmation', () => {
    const safeData = { executeTransaction: spy() }
    let disclaimerHash: string | null = null
    const h = buildHandlers(safeData, (x) => (disclaimerHash = x))
    h.execute('0xhash')
    // Disclaimer is armed for the right tx, nothing executed yet.
    expect(disclaimerHash).to.equal('0xhash')
    expect(safeData.executeTransaction.calls.length).to.equal(0)
    // User agrees -> disclaimer fires onExecute.
    h.confirmExecute(disclaimerHash as any)
    expect(safeData.executeTransaction.calls).to.deep.equal([['0xhash']])
  })
})
