/**
 * Pure helpers for the Headless Onramp UI: chain → network-name mapping and the
 * Coinbase `onramp_api.*` postMessage event → UI-status reducer. Extracted from
 * `CBHeadlessOnramp.tsx` so they can be unit tested without React.
 */

export type HeadlessStatus =
  | 'idle'
  | 'creating'
  | 'iframe-loading'
  | 'ready'
  | 'committing'
  | 'polling'
  | 'success'
  | 'error'

/** Network name used for the buy-quote request. */
export function getQuoteNetworkName(chain: any): string {
  const chainName = chain?.name?.toLowerCase() || 'ethereum'
  const chainId = chain?.id
  switch (chainName) {
    case 'base':
    case 'base sepolia':
    case 'base sepolia testnet':
      return 'base'
    case 'polygon':
      return 'polygon'
    default:
      switch (chainId) {
        case 8453:
        case 84532:
          return 'base'
        case 137:
          return 'polygon'
        default:
          return 'ethereum'
      }
  }
}

/**
 * Network name used for the create-order request. Note: Ethereum/Sepolia map to
 * `arbitrum` here because MoonDAO settles onramp deposits on Arbitrum.
 */
export function getOnrampNetworkName(chain: any): string {
  const chainName = chain?.name?.toLowerCase() || 'ethereum'
  const chainId = chain?.id
  switch (chainName) {
    case 'arbitrum':
    case 'arbitrum one':
    case 'arbitrum sepolia':
      return 'arbitrum'
    case 'base':
    case 'base sepolia':
    case 'base sepolia testnet':
      return 'base'
    case 'polygon':
      return 'polygon'
    case 'optimism':
      return 'optimism'
    case 'ethereum':
    case 'mainnet':
    case 'sepolia':
      return 'arbitrum'
    default:
      switch (chainId) {
        case 42161:
        case 421614:
          return 'arbitrum'
        case 8453:
        case 84532:
          return 'base'
        case 137:
          return 'polygon'
        case 10:
        case 11155420:
          return 'optimism'
        default:
          return 'ethereum'
      }
  }
}

export interface OnrampPostMessage {
  eventName?: string
  data?: { errorCode?: string; errorMessage?: string }
}

export interface OnrampEventResult {
  /** Next status, or null to leave status unchanged. */
  status: HeadlessStatus | null
  /** Error message to surface, if any. */
  error?: string | null
  /** Error code to surface, if any. */
  errorCode?: string | null
  /** True when the success callback should fire. */
  fireSuccess?: boolean
  /** True when the message was not a recognized onramp_api.* event. */
  ignored?: boolean
}

/**
 * Safely parses a postMessage payload into an OnrampPostMessage, or null if it
 * isn't a well-formed object/JSON string.
 */
export function parseOnrampMessage(data: unknown): OnrampPostMessage | null {
  try {
    if (typeof data === 'string') {
      return JSON.parse(data)
    }
    if (data && typeof data === 'object') {
      return data as OnrampPostMessage
    }
  } catch {
    return null
  }
  return null
}

/**
 * Pure reducer mapping a parsed onramp event to the next UI status. `prevStatus`
 * is used so a `cancel` event during polling doesn't incorrectly reset to ready.
 */
export function mapOnrampEvent(
  parsed: OnrampPostMessage | null,
  prevStatus: HeadlessStatus
): OnrampEventResult {
  const name = parsed?.eventName
  if (!name || !name.startsWith('onramp_api.')) {
    return { status: null, ignored: true }
  }

  const errorMessage = parsed?.data?.errorMessage
  const errorCode = parsed?.data?.errorCode || null

  switch (name) {
    case 'onramp_api.load_pending':
      return { status: 'iframe-loading' }
    case 'onramp_api.load_success':
      return { status: 'ready' }
    case 'onramp_api.load_error':
      return {
        status: 'error',
        errorCode,
        error:
          errorMessage ||
          'Failed to initialize Coinbase payment. Please try again.',
      }
    case 'onramp_api.commit_success':
      return { status: 'polling' }
    case 'onramp_api.commit_error':
      return {
        status: 'error',
        errorCode,
        error: errorMessage || 'Payment could not be started.',
      }
    case 'onramp_api.cancel':
      // User dismissed the Apple/Google Pay sheet. Don't clobber an in-flight
      // settlement — only return to ready when not already polling.
      if (prevStatus === 'polling') return { status: null }
      return { status: 'ready' }
    case 'onramp_api.polling_start':
      return { status: 'polling' }
    case 'onramp_api.polling_success':
      return { status: 'success', fireSuccess: true }
    case 'onramp_api.polling_error':
      return {
        status: 'error',
        errorCode,
        error: errorMessage || 'Your transaction could not be completed.',
      }
    default:
      return { status: null }
  }
}
