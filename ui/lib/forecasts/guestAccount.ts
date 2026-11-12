import type { Account } from 'thirdweb/wallets'

type SendTransactionOption = Parameters<Account['sendTransaction']>[0]

export type PrivyTransaction = {
  to?: string
  data?: string
  value?: bigint
  chainId: number
  gasLimit?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number
}

export type PrivySend = (tx: PrivyTransaction) => Promise<{ hash: string }>

/** thirdweb's transaction shape → the fields Privy's `sendTransaction` takes. */
export function toPrivyTransaction(tx: SendTransactionOption): PrivyTransaction {
  const out: PrivyTransaction = { chainId: tx.chainId }
  if (tx.to) out.to = tx.to
  if (tx.data) out.data = tx.data
  if (tx.value != null) out.value = tx.value
  if (tx.gas != null) out.gasLimit = tx.gas
  if (tx.maxFeePerGas != null) out.maxFeePerGas = tx.maxFeePerGas
  if (tx.maxPriorityFeePerGas != null) out.maxPriorityFeePerGas = tx.maxPriorityFeePerGas
  if (tx.nonce != null) out.nonce = Number(tx.nonce)
  return out
}

/**
 * A guest's embedded wallet as a thirdweb Account, for forecast writes only.
 * It is never the site's active wallet, so the rest of the site still sees a
 * signed-out visitor. `send` must skip Privy's confirmation screen.
 */
export function guestForecastAccount(address: string, send: PrivySend): Account {
  return {
    address: address as `0x${string}`,
    async sendTransaction(tx) {
      const { hash } = await send(toPrivyTransaction(tx))
      return { transactionHash: hash as `0x${string}` }
    },
    async signMessage() {
      throw new Error('A guest forecast wallet does not sign messages.')
    },
    async signTypedData() {
      throw new Error('A guest forecast wallet does not sign typed data.')
    },
  }
}
