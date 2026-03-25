import toast from 'react-hot-toast'
import { POPULAR_CRYPTO_EXCHANGES } from './popularCryptoExchanges'

export const LARGE_ONRAMP_FIAT_THRESHOLD_USD = 5000

type LargeAmountExchangeOnrampNoticeProps = {
  walletAddress: string
  className?: string
}

export function LargeAmountExchangeOnrampNotice({
  walletAddress,
  className = '',
}: LargeAmountExchangeOnrampNoticeProps) {
  const trimmed = walletAddress?.trim() ?? ''

  return (
    <div
      className={`bg-sky-500/10 backdrop-blur-sm border border-sky-500/25 rounded-xl p-4 ${className}`}
    >
      <p className="text-sky-100/95 text-sm font-semibold mb-2">Large amount</p>
      <p className="text-sky-100/90 text-sm leading-relaxed mb-3">
        For larger purchases, consider creating an account on a centralized exchange and onramping
        there (bank transfer or card, per that exchange&apos;s options). Once you have crypto on the
        exchange, send or withdraw it to your connected wallet using the address below.
      </p>
      {trimmed ? (
        <div className="mb-3 space-y-2">
          <p className="text-sky-100/80 text-xs font-medium uppercase tracking-wide">
            Your connected wallet
          </p>
          <div className="bg-black/25 border border-sky-500/20 rounded-lg p-3">
            <p
              className="text-white font-mono text-xs sm:text-sm break-all select-all"
              data-testid="large-onramp-wallet-address"
            >
              {trimmed}
            </p>
          </div>
          <button
            type="button"
            data-testid="large-onramp-copy-wallet"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(trimmed)
                toast.success('Address copied to clipboard.')
              } catch {
                toast.error('Could not copy address.')
              }
            }}
            className="w-full text-sm font-medium py-2.5 px-3 rounded-lg bg-sky-600/40 hover:bg-sky-500/50 border border-sky-400/30 text-sky-50 transition-colors"
          >
            Copy address
          </button>
        </div>
      ) : null}
      <ul className="text-sm text-sky-100/90 space-y-1.5 mb-3">
        {POPULAR_CRYPTO_EXCHANGES.map(({ label, href }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-200 underline underline-offset-2 hover:text-white"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sky-100/85 text-sm leading-relaxed">
        Questions? Email{' '}
        <a
          href="mailto:info@moondao.com"
          className="text-sky-200 underline underline-offset-2 hover:text-white"
        >
          info@moondao.com
        </a>
        .
      </p>
    </div>
  )
}
