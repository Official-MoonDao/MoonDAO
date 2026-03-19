/**
 * Collect every EVM address we should treat as "this user" for on-chain / subgraph
 * lookups. Hats are minted to a specific address; Privy's active signer can differ
 * from linked wallets that still hold team/project hats.
 */
export function getLinkedEvmAddresses(
  user: { linkedAccounts?: unknown; wallet?: { address?: string } } | null | undefined,
  activeAccountAddress?: string | null
): string[] {
  const out = new Set<string>()
  const add = (a?: string | null) => {
    if (!a || typeof a !== 'string') return
    const t = a.trim()
    if (/^0x[a-fA-F0-9]{40}$/i.test(t)) {
      out.add(t.toLowerCase())
    }
  }

  add(activeAccountAddress)
  add(user?.wallet?.address)

  const accounts = user?.linkedAccounts
  if (!Array.isArray(accounts)) {
    return Array.from(out)
  }

  for (const acc of accounts as any[]) {
    add(acc?.address)
  }

  return Array.from(out)
}
