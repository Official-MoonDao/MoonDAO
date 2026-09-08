import { LockClosedIcon } from '@heroicons/react/24/outline'
import StandardButton from '@/components/layout/StandardButton'

type JobCitizenUpsellProps = {
  variant?: 'panel' | 'banner'
  headline?: string
  body?: string
}

const COPY = {
  panel: {
    headline: 'Become a Citizen to apply',
    body: 'The role is public. The apply link and how-to-apply steps are for MoonDAO Citizens — people already in the Space Acceleration Network.',
  },
  banner: {
    headline: 'Read every role. Apply as a Citizen.',
    body: 'Browse the full opportunity. Citizenship unlocks application details so teams hear from people who are already part of the network.',
  },
} as const

export default function JobCitizenUpsell({
  variant = 'panel',
  headline,
  body,
}: JobCitizenUpsellProps) {
  const copy = COPY[variant]
  const isBanner = variant === 'banner'

  return (
    <div
      id="job-apply-citizen-upsell"
      className={
        isBanner
          ? 'rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-600/15 via-purple-600/10 to-slate-800/40 p-5 md:p-6'
          : 'rounded-xl border border-white/10 bg-white/5 p-4'
      }
    >
      <div className={isBanner ? 'flex flex-col md:flex-row md:items-center gap-4' : 'flex flex-col gap-3'}>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
              <LockClosedIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-GoodTimes text-white text-base leading-tight">
                {headline || copy.headline}
              </p>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">{body || copy.body}</p>
            </div>
          </div>
        </div>
        <StandardButton
          className={`${isBanner ? 'md:w-auto w-full shrink-0' : 'w-full'} gradient-2 hover:opacity-90 transition-opacity`}
          textColor="text-white"
          borderRadius="rounded-xl"
          hoverEffect={false}
          link="/citizen"
        >
          Become a Citizen
        </StandardButton>
      </div>
    </div>
  )
}
