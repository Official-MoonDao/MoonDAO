import Link from 'next/link'
import { useENS } from '@/lib/utils/hooks/useENS'
import { TOUCH } from '@/components/deprize/detail/primitives'

function shortAddress(address?: string): string {
  if (!address) return 'this wallet'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function WalletLabel(props: { address?: string }) {
  const ens = useENS(props.address, !!props.address)
  const name = ens.data?.name
  if (!props.address) return <>this wallet</>
  if (name && name.toLowerCase() !== props.address.toLowerCase()) {
    return (
      <>
        {name} ({shortAddress(props.address)})
      </>
    )
  }
  return <>{shortAddress(props.address)}</>
}

export default function CitizenPredictNotice(props: {
  loading: boolean
  isCitizen: boolean
  lookupFailed: boolean
  expired: boolean
  activeAddress?: string
  linkedCitizenAddress?: string
  chainLabel: string
  canSwitch: boolean
  onSwitch: () => void
  onConnectLinked: () => void
  onRetry: () => void
}) {
  if (props.isCitizen) return null

  if (props.loading) {
    return <p className="text-sm text-gray-300">Checking your Citizen…</p>
  }

  if (props.expired) {
    return (
      <p className="text-sm text-amber-200">
        {props.linkedCitizenAddress ? (
          <>
            The Citizen on <WalletLabel address={props.linkedCitizenAddress} /> has lapsed. A
            prediction from that wallet is saved with 0 voting power until it is renewed.
          </>
        ) : (
          <>
            Your Citizen on {props.chainLabel} has lapsed. You can still predict, and it is
            saved with 0 voting power until the Citizen is renewed.
          </>
        )}
      </p>
    )
  }

  if (props.linkedCitizenAddress) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-amber-200">
          Your Citizen is on <WalletLabel address={props.linkedCitizenAddress} />. A prediction
          from <WalletLabel address={props.activeAddress} /> is saved with 0 voting power, so it
          does not move the MOONEY outcome.
        </p>
        <button
          type="button"
          onClick={props.canSwitch ? props.onSwitch : props.onConnectLinked}
          className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ${TOUCH}`}
        >
          {props.canSwitch ? 'Switch to that wallet' : 'Connect that wallet'}
        </button>
      </div>
    )
  }

  if (props.lookupFailed) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-amber-200">
          Couldn&apos;t check your Citizen on {props.chainLabel}.
        </p>
        <button
          type="button"
          onClick={props.onRetry}
          className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ${TOUCH}`}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <p className="text-sm text-amber-200">
      You can still predict. It is saved with 0 voting power, so it does not move the MOONEY
      outcome.{' '}
      <Link href="/join" className="text-indigo-300 underline">
        Mint a Citizen
      </Link>{' '}
      if you want it to count.
    </p>
  )
}
