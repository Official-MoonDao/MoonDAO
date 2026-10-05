/**
 * iOS Safari hit-tests a scrolling element that also has backdrop-filter
 * against the position it had before the scroll. Taps then land on the blur
 * layer instead of inputs inside it. Peel backdrop-blur onto a fixed layer
 * that never scrolls and never receives taps.
 */
export function splitBackdropBlur(className: string): {
  scrollClassName: string
  blurClassName: string | null
  blurZClassName: string
} {
  const parts = className.split(/\s+/).filter(Boolean)
  const blurParts = parts.filter((part) => part.startsWith('backdrop-blur'))
  if (blurParts.length === 0) {
    return {
      scrollClassName: className,
      blurClassName: null,
      blurZClassName: 'z-0',
    }
  }

  return {
    scrollClassName: parts.filter((part) => !part.startsWith('backdrop-blur')).join(' '),
    blurClassName: blurParts.join(' '),
    blurZClassName: backdropZClass(className),
  }
}

function backdropZClass(className: string): string {
  const arbitrary = className.match(/\bz-\[(\d+)\]/)
  if (arbitrary) {
    return `z-[${Math.max(Number(arbitrary[1]) - 1, 0)}]`
  }
  const scale = className.match(/\bz-(\d+)\b/)
  if (scale) {
    return `z-[${Math.max(Number(scale[1]) - 1, 0)}]`
  }
  return 'z-0'
}
