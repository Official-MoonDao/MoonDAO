export function formatNumberUSStyle(
  n: string | number | bigint,
  compact: boolean = false
) {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    notation: compact ? 'compact' : 'standard',
  }).format(n as any)
}
