import { getMessagesBySrcTxHash, MessageStatus } from '@layerzerolabs/scan-client'
import { JBV5_TERMINAL_ADDRESS } from 'const/config'
import type { Chain } from '@/lib/rpc/chains'
import { waitForReceipt } from 'thirdweb'

/** JBV5 `Pay` event topic0 (rulesetId, rulesetCycleNumber, projectId indexed). */
const PAY_EVENT_TOPIC0 =
  '0x133161f1c9161488f777ab9a26aae91d47c0d9a3fafb398960f138db02c73797'

function receiptHasTerminalPay(receipt: {
  logs: readonly { topics: string[]; address?: string }[]
}): boolean {
  const terminal = JBV5_TERMINAL_ADDRESS.toLowerCase()
  return receipt.logs.some(
    (log) =>
      log.topics[0] === PAY_EVENT_TOPIC0 &&
      log.address?.toLowerCase() === terminal
  )
}

/**
 * Poll LayerZero Scan for messages from a source tx, then find the **destination** tx on
 * `destinationChain` that actually contains a Juicebox v5 terminal `Pay` log.
 *
 * `waitForMessageReceived(messages[0])` is insufficient for Stargate + lzCompose: there may be
 * multiple delivered messages or the first may be a bridge leg without `Pay`.
 */
export async function waitForCrossChainPayReceipt(params: {
  client: Parameters<typeof waitForReceipt>[0]['client']
  srcChainId: number
  originTxHash: string
  destinationChain: Chain
  pollIntervalMs?: number
}): Promise<Awaited<ReturnType<typeof waitForReceipt>>> {
  const {
    client,
    srcChainId,
    originTxHash,
    destinationChain,
    pollIntervalMs = 3000,
  } = params

  while (true) {
    try {
      const { messages } = await getMessagesBySrcTxHash(srcChainId, originTxHash)
      const delivered = messages.filter(
        (m) => m.status === MessageStatus.DELIVERED && m.dstTxHash
      )
      const triedDst = new Set<string>()
      for (const m of delivered) {
        const hash = m.dstTxHash as `0x${string}`
        const h = hash.toLowerCase()
        if (triedDst.has(h)) continue
        triedDst.add(h)
        try {
          const receipt = await waitForReceipt({
            client,
            chain: destinationChain,
            transactionHash: hash,
          })
          if (receipt && receiptHasTerminalPay(receipt)) {
            return receipt
          }
        } catch {
          /* wrong chain or not indexed yet */
        }
      }
    } catch {
      /* scan/API lag */
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }
}
