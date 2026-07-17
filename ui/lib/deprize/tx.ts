import { sendAndConfirmTransaction } from 'thirdweb'

// Send + confirm a transaction, retrying the transient nonce / replacement
// errors wallets occasionally throw when a second tx is built immediately after
// the first mines. Mirrors the retry used in the deprize-play harness.
export async function sendDePrizeTx(account: any, transaction: any) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendAndConfirmTransaction({ account, transaction })
    } catch (e: any) {
      const msg = `${e?.message || ''} ${e?.shortMessage || ''}`.toLowerCase()
      const retryable =
        msg.includes('nonce') ||
        msg.includes('replacement transaction underpriced') ||
        msg.includes('retryable')
      if (retryable && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2500))
        continue
      }
      throw e
    }
  }
}
