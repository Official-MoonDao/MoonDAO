import Image from 'next/image'
import type { GenerationPhase } from '@/lib/image-generator/useImageGenerator'

export const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: 'Preparing…',
  uploading: 'Uploading your photo…',
  queued: 'Waiting in line…',
  generating: 'Generating your portrait…',
  finishing: 'Finishing up…',
  done: 'Done!',
  error: 'Something went wrong…',
}

const GENERATION_TIPS = [
  'Crafting your MoonDAO astronaut portrait…',
  'Tip: a clear, front-facing photo gives the best results.',
  'Adding some cosmic flair to your image…',
  'Adding the final details to your portrait…',
]

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function computeProgressPct(phase: GenerationPhase, elapsedMs: number): number {
  if (phase === 'done') return 100
  const eased = Math.round((1 - Math.exp(-elapsedMs / 22000)) * 100)
  if (phase === 'finishing') return Math.min(98, Math.max(92, eased))
  return Math.min(90, Math.max(5, eased))
}

export type ImageGenProgressSnapshot = {
  phase: GenerationPhase
  elapsedMs: number
  progressPct: number
  phaseLabel: string
  tipIndex: number
}

type CitizenImageGenerationProgressProps = {
  phase: GenerationPhase
  elapsedMs: number
  progressPct: number
  /** When true, copy encourages continuing the rest of the flow (onboarding). */
  isBackgroundFlow?: boolean
  tipIndex?: number
  /** overlay: full-bleed on image preview; panel: stacked below preview on Review. */
  variant?: 'overlay' | 'panel'
}

export function CitizenImageGenerationProgress({
  phase,
  elapsedMs,
  progressPct,
  isBackgroundFlow = true,
  tipIndex = 0,
  variant = 'overlay',
}: CitizenImageGenerationProgressProps) {
  const phaseLabel = PHASE_LABELS[phase] ?? 'Creating your AI image…'

  const timeline = (
    <div className="flex w-full max-w-[280px] flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{phaseLabel}</span>
        <span className="tabular-nums text-slate-400">{formatElapsed(elapsedMs)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-indigo-400 transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {isBackgroundFlow
          ? 'Generating in the background • ~30–60s'
          : 'Usually takes 30–60 seconds'}
      </p>
    </div>
  )

  const statusLine = (
    <p className="min-h-[1rem] text-xs text-slate-400 transition-opacity duration-300 text-center">
      {isBackgroundFlow
        ? 'Your AI portrait will appear here automatically when it\u2019s ready — keep reviewing below.'
        : GENERATION_TIPS[tipIndex % GENERATION_TIPS.length]}
    </p>
  )

  if (variant === 'panel') {
    return (
      <div className="flex w-full max-w-[400px] flex-col items-center gap-3 px-4">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/MoonDAO-Loading-Animation.svg"
            width={40}
            height={40}
            className="animate-pulse flex-shrink-0"
            alt=""
          />
          <p className="text-sm font-medium text-white">AI portrait in progress</p>
        </div>
        {timeline}
        {statusLine}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/75 px-6 text-center">
      <Image
        src="/assets/MoonDAO-Loading-Animation.svg"
        width={72}
        height={72}
        className="animate-pulse"
        alt="Generating"
      />
      {timeline}
      {statusLine}
    </div>
  )
}
