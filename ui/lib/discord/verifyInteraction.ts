import { verifyKey } from 'discord-interactions'

export async function verifyDiscordRequest(opts: {
  publicKeyHex: string
  signature: string
  timestamp: string
  rawBody: string
}): Promise<boolean> {
  if (!opts.publicKeyHex || !opts.signature || !opts.timestamp) return false
  try {
    return await verifyKey(opts.rawBody, opts.signature, opts.timestamp, opts.publicKeyHex)
  } catch {
    return false
  }
}
