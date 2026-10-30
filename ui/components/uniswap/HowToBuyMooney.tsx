import Link from 'next/link'
import StepFlow, { FlowStep } from '@/components/layout/StepFlow'

const STEPS: FlowStep[] = [
  {
    id: 'sign-in',
    label: 'Sign In',
    subtitle: 'Account',
    description:
      "Sign in with a wallet, email, phone number, or a Google, X, Discord or GitHub account. If you don't have a wallet yet, one is created for you automatically.",
    iconPath:
      'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'network',
    label: 'Network',
    subtitle: 'Choose',
    description:
      'Pick a network with the selector in the swap card. Ethereum has the deepest liquidity. Arbitrum and Base have lower fees, but less liquidity can mean a worse price on larger swaps.',
    iconPath:
      'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  },
  {
    id: 'fund',
    label: 'Fund',
    subtitle: 'Add ETH',
    description:
      "MOONEY is bought with the network's native token, which is ETH on Ethereum, Arbitrum and Base. Send ETH to your wallet on that network from an exchange or another wallet, and keep a little extra to pay network fees.",
    iconPath:
      'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  },
  {
    id: 'quote',
    label: 'Amount',
    subtitle: 'Get a quote',
    description:
      "Enter how much ETH to spend. The card shows a live Uniswap v4 quote: how much MOONEY you'll receive, the price impact, and the estimated network fee. Max fills your balance minus a reserve for fees.",
    iconPath:
      'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    id: 'swap',
    label: 'Swap',
    subtitle: 'Confirm',
    description:
      'Press Swap and approve the transaction in your wallet. Swaps are protected by a 5% slippage limit: if the price moves further than that before confirming, the transaction reverts instead of filling. MOONEY arrives in your wallet once it confirms.',
    iconPath: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  },
  {
    id: 'lock',
    label: 'Lock',
    subtitle: 'Vote',
    description: (
      <>
        Optional: lock MOONEY on the{' '}
        <Link href="/lock" className="text-blue-400 hover:text-blue-300 underline">
          Lock page
        </Link>{' '}
        to get vMOONEY, which gives you voting power in MoonDAO governance. Longer locks, up to four
        years, give more voting power.
      </>
    ),
    iconPath:
      'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  },
]

export default function HowToBuyMooney() {
  return (
    <div className="bg-black/20 rounded-xl p-3 sm:p-5 border border-white/10">
      <h2 className="font-heading font-semibold text-white text-base sm:text-lg">
        How to buy MOONEY
      </h2>
      <p className="mt-1 mb-3 text-sm text-gray-400">
        Six steps from sign-in to voting power. Tap a step to read more.
      </p>
      <StepFlow steps={STEPS} autoplay />
    </div>
  )
}
