import type { ParticipationKind } from '@/lib/lunar-atlas/display'

// Keep these class strings in `components/` so Tailwind's content scan emits them.
export const PARTICIPATION_ROW_CLASSES: Record<ParticipationKind, string> = {
  official: 'border-emerald-400/30 bg-emerald-500/[0.08]',
  unofficial: 'border-zinc-400/25 bg-zinc-500/[0.10]',
  declined: 'border-rose-400/25 bg-rose-500/[0.06]',
}

export const PARTICIPATION_BAR_CLASSES: Record<ParticipationKind, string> = {
  official: 'bg-emerald-400',
  unofficial: 'bg-zinc-400',
  declined: 'bg-rose-400',
}
