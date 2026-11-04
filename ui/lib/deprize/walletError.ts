/**
 * One short sentence for a failed wallet call. Raw ethers and viem messages
 * dump provider JSON into the UI, so anything long or structured falls back.
 */
export function walletErrorMessage(err: unknown, fallback: string): string {
  const e = (err ?? {}) as { code?: unknown; shortMessage?: unknown; message?: unknown }
  const text = [e.shortMessage, e.message].filter((v) => typeof v === 'string').join(' ')

  if (e.code === 'NETWORK_ERROR' || /underlying network changed|network changed/i.test(text)) {
    return 'Your wallet switched networks. Try again.'
  }
  if (
    e.code === 4001 ||
    e.code === 'ACTION_REJECTED' ||
    /user (rejected|denied)|rejected the request/i.test(text)
  ) {
    return 'Cancelled in your wallet.'
  }

  const short = typeof e.shortMessage === 'string' ? e.shortMessage : undefined
  const msg = short ?? (typeof e.message === 'string' ? e.message : undefined)
  if (!msg || msg.length > 120 || /[{}]|0x[0-9a-f]{20,}/i.test(msg)) return fallback
  return msg
}
