import { useEffect, useRef, useState } from 'react'

/**
 * Live countdown to a mission deadline, with millisecond precision.
 *
 * Render goal: drop into the existing "Deadline" stat card in
 * `MissionProfileHeader` in place of the static `duration` string and look
 * native to the surrounding GoodTimes typography. The unit letters (`d` /
 * `h` / `m` / `s`) are rendered in a muted gray so the digits read first;
 * `tabular-nums` keeps the digits from jittering as they tick.
 *
 * Layout stability: the previous implementation used `flex-wrap`, which
 * meant that at borderline card widths the seconds chunk would oscillate
 * between fitting on the same line and wrapping to a new one as digits
 * ticked, causing the card to grow and shrink vertically. We now lock the
 * layout instead — `flex-col` on small screens (always two fixed rows) and
 * `flex-row` with `whitespace-nowrap` on `sm:` and up (always one fixed
 * row). The breakpoint matches the rest of the deadline card, which already
 * scales typography at `sm:`.
 */
interface MissionDeadlineCountdownProps {
  deadline: number
  className?: string
}

function pad(value: number, length = 2) {
  return value.toString().padStart(length, '0')
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const SECOND_MS = 1000

export default function MissionDeadlineCountdown({
  deadline,
  className = '',
}: MissionDeadlineCountdownProps) {
  const [now, setNow] = useState(() => Date.now())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      setNow(Date.now())
      rafRef.current =
        typeof window !== 'undefined' && window.requestAnimationFrame
          ? window.requestAnimationFrame(tick)
          : (setTimeout(tick, 50) as unknown as number)
    }

    tick()

    return () => {
      cancelled = true
      if (rafRef.current != null) {
        if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
          window.cancelAnimationFrame(rafRef.current)
        } else {
          clearTimeout(rafRef.current as unknown as ReturnType<typeof setTimeout>)
        }
      }
    }
  }, [])

  const remaining = Math.max(0, deadline - now)
  const days = Math.floor(remaining / DAY_MS)
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS)
  const seconds = Math.floor((remaining % MINUTE_MS) / SECOND_MS)
  const millis = Math.floor(remaining % SECOND_MS)

  return (
    <div
      className={`text-white font-GoodTimes leading-tight tabular-nums text-[10px] sm:text-sm flex flex-col sm:flex-row sm:items-baseline sm:flex-nowrap sm:gap-1 ${className}`}
      role="timer"
      aria-label={`Time remaining: ${days} days, ${hours} hours, ${minutes} minutes, ${seconds}.${pad(
        millis,
        3
      )} seconds`}
    >
      <span className="whitespace-nowrap">
        {days > 0 ? (
          <>
            {pad(days)}
            <span className="text-gray-400">d</span>{' '}
          </>
        ) : null}
        {pad(hours)}
        <span className="text-gray-400">h</span>{' '}
        {pad(minutes)}
        <span className="text-gray-400">m</span>
      </span>
      <span className="whitespace-nowrap">
        {pad(seconds)}
        <span className="text-white/70">.{pad(millis, 3)}</span>
        <span className="text-gray-400">s</span>
      </span>
    </div>
  )
}
