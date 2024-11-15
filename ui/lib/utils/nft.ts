export function getAttribute(attributes: any[], traitType: string) {
  if (!attributes) return null
  return Object.values(attributes).find(
    (attr: any) => attr.trait_type === traitType
  )
}
