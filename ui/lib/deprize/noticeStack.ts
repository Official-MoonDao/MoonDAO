export type NoticeTone = 'amber' | 'red'

export type NoticeItemBase<T = unknown> = {
  id: string
  tone: NoticeTone
  /** Lower number = higher priority among amber notices. */
  priority: number
  body: T
}

/** Keep every red notice; keep only the highest-priority amber notice. */
export function pickNotices<T extends NoticeItemBase>(items: T[]): T[] {
  const red = items.filter((item) => item.tone === 'red')
  const amber = items
    .filter((item) => item.tone === 'amber')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 1)
  return [...red, ...amber]
}
