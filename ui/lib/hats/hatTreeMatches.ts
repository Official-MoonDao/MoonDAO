/** Compare hat tree ids from subgraph vs config (handles hex padding differences). */
export function hatTreeMatches(hatTreeId: string, configTreeId: string): boolean {
  try {
    return BigInt(hatTreeId).toString() === BigInt(configTreeId).toString()
  } catch {
    return hatTreeId === configTreeId
  }
}
