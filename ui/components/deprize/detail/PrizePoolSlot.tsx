import { DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import {
  describePayloadTier,
  payloadCopy,
  payloadCopyMode,
  payloadTierExplainer,
} from '@/lib/deprize/payloadPurse'

export default function PrizePoolSlot(props: {
  poolUsd?: number | null
  asOf?: string | null
}) {
  const mode = payloadCopyMode(DEPRIZE_TERMS_VERSION)
  const tier = describePayloadTier(props.poolUsd)
  const explainer = payloadTierExplainer({
    mode,
    poolUsd: props.poolUsd,
    asOf: props.asOf,
  })

  return (
    <section
      id="deprize-prize-pool"
      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-4"
    >
      <p className="text-gray-400 text-sm leading-relaxed">
        {payloadCopy('disclosureSentence', mode)}
      </p>
      <p className="text-gray-400 text-sm leading-relaxed">{explainer}</p>
      {tier.id !== 'unknown' && props.asOf ? (
        <p className="text-gray-500 text-xs font-mono">asOf {props.asOf}</p>
      ) : null}
    </section>
  )
}
