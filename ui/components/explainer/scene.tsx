import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'

export const SPRING = { type: 'spring', stiffness: 120, damping: 20 } as const

/** `tour` sits over the Moon Base Zero scene, so it is shorter and opaque enough to read. */
export type SceneVariant = 'page' | 'tour'

export type SceneProps = {
  variant?: SceneVariant
  /**
   * Plays from the start each time this turns true and resets when it turns
   * false. The tour sets it from the active stop, since every tour card shares
   * one fixed frame and would otherwise count as on screen from page load.
   * Without it the scene plays once when it comes into view.
   */
  active?: boolean
}

export type SceneTag = { label: string; text: string; bg: string }

const FRAME_CLASS: Record<SceneVariant, string> = {
  page: 'h-[340px] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5 sm:p-6',
  tour: 'h-[290px] bg-[#070a12]/90 p-4 backdrop-blur-md sm:p-5',
}

/**
 * Which step of `steps` the scene is on, on a timeline that starts when the
 * scene is active (or seen). One-shot by default; with `loop` it holds the last
 * step briefly, starts over, and pauses while off screen. Reduced motion jumps
 * to the last step.
 */
export function useSceneStep(
  ref: RefObject<Element>,
  steps: number,
  active: boolean | undefined,
  replayKey: number,
  loop = false
): { step: number; done: boolean } {
  const reduce = useReducedMotion()
  const inView = useInView(ref, { amount: 0.4, once: !loop })
  const playing = active ?? inView
  const timeline = useMotionValue(0)
  const toStep = (v: number) => Math.max(0, Math.min(steps - 1, Math.floor(v * steps)))
  const [step, setStep] = useState(0)
  useMotionValueEvent(timeline, 'change', (v) => setStep(toStep(v)))

  useEffect(() => {
    if (reduce) return
    timeline.set(0)
    if (!playing) return
    const controls = animate(timeline, 1, {
      duration: steps * 1.15,
      ease: 'linear',
      ...(loop ? { repeat: Infinity, repeatDelay: 2.5 } : {}),
    })
    return () => controls.stop()
  }, [reduce, playing, timeline, steps, replayKey, loop])

  const shown = reduce ? steps - 1 : step
  return { step: shown, done: shown === steps - 1 }
}

export function useReplay() {
  const [key, setKey] = useState(0)
  return { key, replay: () => setKey((k) => k + 1) }
}

export function SceneFrame({
  sceneRef,
  label,
  variant = 'page',
  tag,
  title,
  caption,
  onReplay,
  children,
}: {
  sceneRef: RefObject<HTMLDivElement>
  label: string
  variant?: SceneVariant
  tag: SceneTag
  title: string
  caption: ReactNode
  onReplay?: () => void
  children: ReactNode
}) {
  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label={label}
      className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] ${FRAME_CLASS[variant]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tag.bg} ${tag.text}`}>
          {tag.label}
        </span>
        <span className="truncate text-[11px] text-gray-500">{title} · illustration</span>
      </div>
      <div className="relative mt-3 min-h-0 flex-1">{children}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-h-[2.5em] text-xs leading-snug text-gray-400">{caption}</div>
        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:border-white/30 hover:text-white"
          >
            Replay
          </button>
        )}
      </div>
    </div>
  )
}

/** Caption that cross-fades per step, so each step says one thing. */
export function StepCaption({ step, lines }: { step: number; lines: ReactNode[] }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={step}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
      >
        {lines[Math.min(step, lines.length - 1)]}
      </motion.p>
    </AnimatePresence>
  )
}
