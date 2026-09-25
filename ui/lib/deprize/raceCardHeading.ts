/** Short card name when the atlas title is one sentence with no em dash. */
const RACE_CARD_NAMES: Record<string, string> = {
  'shared-landing-pads': 'Landing pads',
  'shared-isru-oxygen': 'ISRU',
  'shared-fission-power': 'Fission',
  'shared-habitat': 'Habitat',
  'shared-lunar-comms': 'Comms',
  'shared-mass-driver': 'Mass driver',
  'shared-crewed-lander': 'Crewed landing',
  'shared-lunar-rover': 'Lunar rover',
}

export function capitalizeFirst(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Short name plus the rest of the atlas title, with the subtitle capitalized. */
export function raceCardHeading(goal: { id: string; title: string }): {
  name: string
  subtitle?: string
} {
  const parts = goal.title.split(/\s+[—–]\s+/)
  if (parts.length >= 2 && parts[0]) {
    return { name: parts[0], subtitle: capitalizeFirst(parts.slice(1).join(' — ')) }
  }
  const name = RACE_CARD_NAMES[goal.id]
  if (name) return { name, subtitle: capitalizeFirst(goal.title) }
  return { name: goal.title }
}
