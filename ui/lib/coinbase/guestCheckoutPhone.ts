/**
 * Coinbase guest checkout only accepts a US number. Privy treats a bare
 * 10-digit value as +1, and ignores other punctuation.
 */
export function toGuestCheckoutPhone(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    if (digits.length !== 11 || !digits.startsWith('1')) return null
    return `+${digits}`
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function sameGuestCheckoutPhone(a: string, b: string): boolean {
  const left = toGuestCheckoutPhone(a)
  const right = toGuestCheckoutPhone(b)
  return !!left && left === right
}
