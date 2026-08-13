import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

const LINE_CLAMP_CLASS: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

type ExpandableTextProps = {
  children: ReactNode
  className?: string
  lines?: number
  buttonClassName?: string
  moreLabel?: string
  lessLabel?: string
  id?: string
}

/**
 * Clamps body copy to a fixed number of lines and reveals a Read more control
 * only when the text actually overflows at the current width. This keeps card
 * previews compact without hiding content on smaller screens.
 */
export default function ExpandableText({
  children,
  className = '',
  lines = 2,
  buttonClassName = 'mt-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors',
  moreLabel = 'Read more',
  lessLabel = 'Show less',
  id,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  const measure = useCallback(() => {
    const el = textRef.current
    if (!el || expanded) return
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [expanded])

  useIsomorphicLayoutEffect(() => {
    measure()
    const el = textRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => measure())
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, children, lines])

  if (children == null || children === '') return null

  const clampClass = expanded ? '' : LINE_CLAMP_CLASS[lines] || 'line-clamp-2'

  return (
    <div className="min-w-0">
      <div
        id={id}
        ref={textRef}
        data-testid="expandable-text"
        data-expanded={expanded ? 'true' : 'false'}
        className={`${className} break-words ${clampClass}`.trim()}
      >
        {children}
      </div>
      {(overflows || expanded) && (
        <button
          type="button"
          data-testid="expandable-text-toggle"
          aria-expanded={expanded}
          className={buttonClassName}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setExpanded((isExpanded) => !isExpanded)
          }}
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  )
}
