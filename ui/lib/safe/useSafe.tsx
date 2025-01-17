import { SafeTransactionOptionalProps } from '@safe-global/protocol-kit'
import { MetaTransactionData } from '@safe-global/types-kit'
import useSafeApiKit from './useSafeApiKit'

export default function useSafe(safeAddress: string) {
  const { safeApiKit, protocolKit } = useSafeApiKit(safeAddress)

  async function queueSafeTx(
    senderAddress: string,
    transactions: MetaTransactionData[],
    options: SafeTransactionOptionalProps
  ) {
    try {
      const safeTx = await protocolKit?.createTransaction({
        transactions,
        options,
      })
      const safeTxHash = await protocolKit.getTransactionHash(safeTx)

      if (!safeTx || !safeTxHash)
        throw new Error('Failed to create transaction or get transaction hash')

      const signature = await protocolKit.signHash(safeTxHash)

      if (!signature) throw new Error('Failed to sign transaction hash')

      await safeApiKit?.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTx.data,
        safeTxHash,
        senderAddress,
        senderSignature: signature.data,
      })
    } catch (err) {
      console.log(err)
    }
  }

  return { queueSafeTx }
}
