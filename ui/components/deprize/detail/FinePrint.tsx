import {
  isRaceBindingComplete,
  ROSTER_DISCLAIMER,
  type DePrizeRaceOutcome,
} from '@/lib/deprize/competitions'
import { DEPRIZE_AVAILABILITY_LEGEND, DEPRIZE_TERMS_VERSION } from '@/lib/deprize/constants'
import { payloadCopy, payloadCopyMode, payloadTierExplainer } from '@/lib/deprize/payloadPurse'

export default function FinePrint(props: {
  poolUsd?: number | null
  asOf?: string | null
  raceBinding?: { outcomes?: readonly DePrizeRaceOutcome[] }
}) {
  const mode = payloadCopyMode(DEPRIZE_TERMS_VERSION)
  const disclosure = payloadCopy('disclosureSentence', mode)
  const explainer = payloadTierExplainer({
    mode,
    poolUsd: props.poolUsd,
    asOf: props.asOf,
  })
  const showRoster = isRaceBindingComplete(props.raceBinding?.outcomes)

  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-gray-500">
      <summary className="cursor-pointer text-sm text-gray-400">Fine print</summary>
      <div className="mt-3 space-y-2 leading-relaxed">
        <p>{disclosure}</p>
        <p>{explainer}</p>
        <p>
          Gift pays and smart-account pays are counted in the pool but not attributed by name.
          The prize pool also includes bet fees; patrons are direct contributions only.
        </p>
        {showRoster && <p>{ROSTER_DISCLAIMER}</p>}
        <p>{DEPRIZE_AVAILABILITY_LEGEND}</p>
      </div>
    </details>
  )
}
