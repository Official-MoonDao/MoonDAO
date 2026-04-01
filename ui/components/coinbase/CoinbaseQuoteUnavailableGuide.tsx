import toast from 'react-hot-toast'
import { POPULAR_CRYPTO_EXCHANGES } from './popularCryptoExchanges'

type CoinbaseQuoteUnavailableGuideProps = {
  walletAddress: string
  networkName?: string
}

export function CoinbaseQuoteUnavailableGuide({
  walletAddress,
  networkName,
}: CoinbaseQuoteUnavailableGuideProps) {
  const trimmed = walletAddress?.trim() ?? ''
  const networkHint = networkName?.trim()

  return (
    <div
      className="w-full text-left space-y-4"
      data-testid="cbonramp-exchange-funding-guide"
    >
      <p className="text-amber-100/95 text-sm leading-relaxed">
        We can&apos;t process this amount through Coinbase in this flow. You can still fund your
        wallet by buying crypto on an exchange and sending it to your address below.
      </p>

      <ol className="text-sm text-amber-50/95 space-y-3 list-none pl-0">
        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-amber-200 text-xs font-semibold"
            aria-hidden
          >
            1
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-amber-100 mb-1">Open an exchange account</p>
            <p className="text-amber-100/85 leading-relaxed">
              If you don&apos;t already use one, create an account on a centralized exchange.
              Examples:{' '}
              {POPULAR_CRYPTO_EXCHANGES.map(({ label, href }, i) => (
                <span key={href}>
                  {i > 0 ? ', ' : null}
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-200 underline underline-offset-2 hover:text-white"
                  >
                    {label}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-amber-200 text-xs font-semibold"
            aria-hidden
          >
            2
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-amber-100 mb-1">Buy ETH on the exchange</p>
            <p className="text-amber-100/85 leading-relaxed">
              Follow that exchange&apos;s steps to add funds (for example bank transfer or debit
              card, depending on what they offer in your region) and purchase ETH.
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-amber-200 text-xs font-semibold"
            aria-hidden
          >
            3
          </span>
          <div className="min-w-0 pt-0.5 space-y-2">
            <p className="font-medium text-amber-100 mb-1">Send ETH to this wallet</p>
            <p className="text-amber-100/85 leading-relaxed">
              Withdraw or send ETH from the exchange to your connected wallet. Use the address
              below and choose the same network you are using here
              {networkHint ? (
                <>
                  {' '}
                  (<span className="text-amber-100">{networkHint}</span>)
                </>
              ) : null}
              .
            </p>
            {trimmed ? (
              <div className="space-y-2">
                <div className="bg-black/30 border border-amber-500/25 rounded-lg p-3">
                  <p
                    className="text-white font-mono text-xs sm:text-sm break-all select-all"
                    data-testid="cbonramp-exchange-guide-wallet-address"
                  >
                    {trimmed}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="cbonramp-exchange-guide-copy-wallet"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(trimmed)
                      toast.success('Address copied to clipboard.')
                    } catch {
                      toast.error('Could not copy address.')
                    }
                  }}
                  className="w-full text-sm font-medium py-2.5 px-3 rounded-lg bg-amber-600/35 hover:bg-amber-500/45 border border-amber-400/30 text-amber-50 transition-colors"
                >
                  Copy wallet address
                </button>
              </div>
            ) : null}
          </div>
        </li>

        <li className="flex gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-amber-200 text-xs font-semibold"
            aria-hidden
          >
            4
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-amber-100 mb-1">Finish your contribution</p>
            <p className="text-amber-100/85 leading-relaxed">
              After the ETH appears in your wallet, close this message and try your contribution
              again.
            </p>
          </div>
        </li>
      </ol>

      <p className="text-amber-100/80 text-xs leading-relaxed border-t border-amber-500/20 pt-3">
        Questions? Email{' '}
        <a
          href="mailto:info@moondao.com"
          className="text-amber-200 underline underline-offset-2 hover:text-white"
        >
          info@moondao.com
        </a>
        .
      </p>
    </div>
  )
}
