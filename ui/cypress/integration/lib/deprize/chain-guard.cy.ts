import { isWrongNetwork, parseWalletChainId } from '@/lib/deprize/chain-guard'
import { isRetryableSendError, sendDePrizeTx } from '@/lib/deprize/tx'

const ARBITRUM = 42161
const MAINNET = 1

// Verbatim from the reported failure: the wallet was on Ethereum mainnet while
// the app was set to Arbitrum, so the nonce came from one chain and the
// broadcast went to the other.
const REPORTED_ERROR =
  'RPC 0x1 Infura eth_sendRawTransaction: nonce=154 maxNonce=69 ' +
  'txHash=0x75e81b63b59334629bf2d13ba4e3f673c565e4da21fdbfaecb0bad30f7b78fbe: nonce too high'

describe('deprize chain guard', () => {
  describe('parseWalletChainId', () => {
    it('reads the CAIP-2 chain id Privy reports', () => {
      expect(parseWalletChainId('eip155:42161')).to.equal(ARBITRUM)
      expect(parseWalletChainId('eip155:1')).to.equal(MAINNET)
    })

    it('returns null when the wallet has no usable chain id', () => {
      expect(parseWalletChainId(undefined)).to.equal(null)
      expect(parseWalletChainId(null)).to.equal(null)
      expect(parseWalletChainId('')).to.equal(null)
      expect(parseWalletChainId('eip155:not-a-number')).to.equal(null)
    })
  })

  describe('isWrongNetwork', () => {
    it('flags the reported case: wallet on mainnet, DePrize on Arbitrum', () => {
      expect(isWrongNetwork(MAINNET, ARBITRUM)).to.equal(true)
    })

    it('allows betting when the wallet already matches', () => {
      expect(isWrongNetwork(ARBITRUM, ARBITRUM)).to.equal(false)
    })

    it('does not block when the wallet chain is still unknown', () => {
      // Privy reports no chain id until the wallet finishes connecting; blocking
      // there would strand a correctly-configured user behind a switch button.
      expect(isWrongNetwork(null, ARBITRUM)).to.equal(false)
    })
  })

  describe('isRetryableSendError', () => {
    it('does not retry the reported nonce-too-high error', () => {
      expect(isRetryableSendError(REPORTED_ERROR)).to.equal(false)
    })

    it('still retries the transient races the helper exists for', () => {
      expect(isRetryableSendError('replacement transaction underpriced')).to.equal(true)
      expect(isRetryableSendError('nonce too low')).to.equal(true)
      expect(isRetryableSendError('retryable error, please try again')).to.equal(true)
    })

    it('does not retry unrelated failures', () => {
      expect(isRetryableSendError('user rejected the request')).to.equal(false)
    })
  })

  describe('sendDePrizeTx', () => {
    it('surfaces nonce-too-high immediately instead of re-prompting the wallet', async () => {
      let calls = 0
      const send = async () => {
        calls += 1
        throw new Error(REPORTED_ERROR)
      }

      let threw: Error | null = null
      try {
        await sendDePrizeTx({} as any, {} as any, { send, delayMs: 0 })
      } catch (err: any) {
        threw = err
      }

      expect(threw, 'the error should reach the caller').to.not.equal(null)
      expect(calls, 'the wallet should be prompted exactly once').to.equal(1)
    })

    it('still retries a genuinely transient failure and succeeds', async () => {
      let calls = 0
      const send = async () => {
        calls += 1
        if (calls < 3) throw new Error('replacement transaction underpriced')
        return 'receipt'
      }

      const result = await sendDePrizeTx({} as any, {} as any, { send, delayMs: 0 })

      expect(result).to.equal('receipt')
      expect(calls).to.equal(3)
    })
  })
})
