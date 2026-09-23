import { sendAndConfirmTransaction } from 'thirdweb'

const MAX_ATTEMPTS = 4
const RETRY_DELAY_MS = 2500

/**
 * Transient send failures are worth retrying; a nonce that is *ahead* of the
 * chain is not. `nonce too high` means the transaction was built against a
 * different chain than the wallet is broadcasting on, so every retry just
 * re-prompts the wallet with the same doomed nonce and delays the real error.
 */
export function isRetryableSendError(message: string): boolean {
  const msg = (message || '').toLowerCase()
  if (msg.includes('nonce too high')) return false
  return (
    msg.includes('nonce') ||
    msg.includes('replacement transaction underpriced') ||
    msg.includes('retryable')
  )
}

type SendDePrizeTxOptions = {
  /** Injectable for tests; defaults to thirdweb's send + confirm. */
  send?: (args: { account: any; transaction: any }) => Promise<any>
  delayMs?: number
}

// Send + confirm a transaction, retrying the transient nonce / replacement
// errors wallets occasionally throw when a second tx is built immediately after
// the first mines. Mirrors the retry used in the deprize-play harness.
export async function sendDePrizeTx(
  account: any,
  transaction: any,
  { send = sendAndConfirmTransaction, delayMs = RETRY_DELAY_MS }: SendDePrizeTxOptions = {}
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send({ account, transaction })
    } catch (e: any) {
      const msg = `${e?.message || ''} ${e?.shortMessage || ''}`
      if (isRetryableSendError(msg) && attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }
      throw e
    }
  }
}
