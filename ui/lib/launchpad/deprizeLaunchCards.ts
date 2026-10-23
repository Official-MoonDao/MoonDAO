/**
 * Cards for the DePrize mission table on /launch.
 *
 * A row is listed only when its Juicebox metadata URI is a public prize page.
 * The internal demo (“The Moon is a harsh mistress”) is an IPFS document, so
 * it stays off this list. A newer mission for the same prize replaces the
 * older card, so the public Touchdown mission takes the place of the current
 * one once it is created.
 */

export type DeprizeLaunchRow = {
  id: number
  projectId: number
  uri: string
}

export type DeprizeLaunchCard = {
  id: string
  projectId: string
  title: string
  href: string
}

const PRIZE_TITLES: Record<string, string> = {
  'shared-next-landing': 'Touchdown',
  'shared-night-shift': 'Night Shift',
  'shared-first-tracks': 'First Tracks',
  'shared-ice': 'Water Ice',
}

export function goalFromPrizeUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined
  let path = uri.trim()
  try {
    const url = new URL(path)
    if (url.hostname !== 'moondao.com') return undefined
    path = url.pathname
  } catch {
    /* already a path */
  }
  const match = path.match(/^\/deprize\/([a-z0-9-]+)\/?$/)
  return match?.[1]
}

/**
 * Public prize cards, one per goal. The highest mission id wins when two
 * missions point at the same prize.
 */
export function deprizeLaunchCards(rows: readonly DeprizeLaunchRow[]): DeprizeLaunchCard[] {
  const latest = new Map<string, DeprizeLaunchCard>()
  for (const row of rows) {
    if (!Number.isInteger(row.id) || row.id < 0) continue
    const goal = goalFromPrizeUri(row.uri)
    if (!goal) continue
    const card: DeprizeLaunchCard = {
      id: String(row.id),
      projectId: String(row.projectId),
      title: PRIZE_TITLES[goal] ?? goal,
      href: `/deprize/${goal}`,
    }
    const prev = latest.get(goal)
    if (!prev || Number(card.id) > Number(prev.id)) latest.set(goal, card)
  }
  return [...latest.values()].sort((a, b) => Number(a.id) - Number(b.id))
}
