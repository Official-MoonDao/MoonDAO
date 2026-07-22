/**
 * Pure helpers for MoonDAO team role (Hats Protocol) management.
 *
 * Team hat tree created by `MoonDAOTeamCreator.createMoonDAOTeam`:
 *
 *   Team Admin Hat   maxSupply 1   eligibility/toggle = Safe   -> worn by the team Safe (singleton)
 *     Team Manager Hat   maxSupply 8     admin = admin hat       -> worn by managers
 *       Team Member Hat  maxSupply 1000  controlled by manager   -> worn by members
 *
 * Consequences that drive the UI:
 *  - The Admin hat is a 1/1 hat already worn by the Safe, so it is NOT assignable
 *    to a person. The elevated, human-assignable role is "Manager".
 *  - Minting/removing the Manager hat requires the admin hat wearer (the Safe),
 *    so those actions are queued as Safe transactions.
 *  - The Member hat is controlled by the Manager hat (via the passthrough module),
 *    so a connected manager can mint/remove members directly.
 */

export type RoleTxRouting = 'safe' | 'direct'

const ZERO_PADDED_LENGTH = 64

function normalizeHatId(hatId: string | number | bigint): string {
  return String(hatId).toLowerCase()
}

/**
 * Convert a decimal / bigint hat id into its canonical 0x-prefixed, 32-byte
 * (64 hex char) lowercase representation. This matches the format returned by
 * the Hats subgraph for `hat.id`, so the two can be compared directly.
 */
export function toHatIdHex(hatId: string | number | bigint): string {
  return '0x' + BigInt(hatId).toString(16).padStart(ZERO_PADDED_LENGTH, '0')
}

/** True when `hatId` (subgraph hex) is the team's manager hat. */
export function isManagerHat(
  hatId: string | undefined | null,
  managerHatId: string | number | bigint | undefined | null
): boolean {
  if (!hatId || managerHatId === undefined || managerHatId === null) return false
  return normalizeHatId(hatId) === normalizeHatId(toHatIdHex(managerHatId))
}

/** True when `hatId` (subgraph hex) is the team's admin hat. */
export function isAdminHat(
  hatId: string | undefined | null,
  adminHatId: string | number | bigint | undefined | null
): boolean {
  if (!hatId || adminHatId === undefined || adminHatId === null) return false
  return normalizeHatId(hatId) === normalizeHatId(toHatIdHex(adminHatId))
}

/**
 * Elevated roles (manager or admin) can only be changed by the Safe, so any
 * mint/remove targeting them must be queued as a Safe transaction.
 */
export function requiresSafeTx(
  hatId: string | undefined | null,
  managerHatId: string | number | bigint | undefined | null,
  adminHatId: string | number | bigint | undefined | null
): boolean {
  return isManagerHat(hatId, managerHatId) || isAdminHat(hatId, adminHatId)
}

/**
 * True when removing `hatId` would leave the team with no manager.
 *
 * `managerCount` is the number of distinct wallets currently wearing the manager
 * hat. A team with zero managers can no longer manage its own roles (only the
 * manager hat wearer or the Safe owner can), so the UI must block removing the
 * manager hat while it is the last one held.
 */
export function wouldRemoveLastManager(
  hatId: string | undefined | null,
  managerHatId: string | number | bigint | undefined | null,
  managerCount: number
): boolean {
  return isManagerHat(hatId, managerHatId) && (managerCount ?? 0) <= 1
}

/** Routing for a role mint/remove: 'safe' (multisig) or 'direct' (connected wallet). */
export function getRoleTxRouting(
  hatId: string | undefined | null,
  managerHatId: string | number | bigint | undefined | null,
  adminHatId: string | number | bigint | undefined | null
): RoleTxRouting {
  return requiresSafeTx(hatId, managerHatId, adminHatId) ? 'safe' : 'direct'
}

/** Strict EVM address check (0x + 40 hex chars). */
export function isValidEthereumAddress(address: string | undefined | null): boolean {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address)
}

export type RoleTx = {
  /** Contract the transaction is sent to. */
  to: string
  /** Hats function being called. */
  functionName: 'mintHat' | 'setHatWearerStatus'
  /** Arguments, in ABI order. */
  args: any[]
  /** Whether this must be queued on the Safe or sent by the connected wallet. */
  routing: RoleTxRouting
}

/**
 * Build the transaction descriptor for ADDING a role (minting a hat).
 *
 * Minting always targets the Hats contract:
 *  - manager/admin hats: the Safe (admin of the manager hat) must mint -> 'safe'
 *  - member hats: a connected manager (admin of the member hat) mints -> 'direct'
 */
export function buildAddRoleTx({
  hatId,
  memberAddress,
  managerHatId,
  adminHatId,
  hatsAddress,
}: {
  hatId: string
  memberAddress: string
  managerHatId: string | number | bigint | undefined | null
  adminHatId: string | number | bigint | undefined | null
  hatsAddress: string
}): RoleTx {
  return {
    to: hatsAddress,
    functionName: 'mintHat',
    args: [hatId, memberAddress],
    routing: getRoleTxRouting(hatId, managerHatId, adminHatId),
  }
}

/**
 * Build the transaction descriptor for REMOVING a role (revoking eligibility).
 *
 * `setHatWearerStatus` may only be called by the hat's eligibility module:
 *  - manager/admin hats: eligibility module is the Safe, so the Safe calls the
 *    Hats contract directly -> target = Hats, 'safe'
 *  - member hats: eligibility module is the passthrough module, so the call must
 *    be sent to that module (which a connected manager is authorized to use)
 *    -> target = passthrough module, 'direct'
 */
export function buildRemoveRoleTx({
  hatId,
  wearerAddress,
  managerHatId,
  adminHatId,
  hatsAddress,
  memberPassthroughModuleAddress,
}: {
  hatId: string
  wearerAddress: string
  managerHatId: string | number | bigint | undefined | null
  adminHatId: string | number | bigint | undefined | null
  hatsAddress: string
  memberPassthroughModuleAddress: string
}): RoleTx {
  const routing = getRoleTxRouting(hatId, managerHatId, adminHatId)
  return {
    to: routing === 'safe' ? hatsAddress : memberPassthroughModuleAddress,
    functionName: 'setHatWearerStatus',
    // Revoke eligibility, keep good standing (no slashing): eligible=false, standing=true
    args: [hatId, wearerAddress, false, true],
    routing,
  }
}

/**
 * Human-friendly label for a role hat, resilient to missing IPFS metadata.
 * The manager hat is labelled deterministically (no IPFS dependency) so the
 * elevated role is always discoverable even if metadata fails to load.
 * Other sub-hats fall back to their IPFS name, then to "Member".
 */
export function getRoleLabel(
  hatId: string | undefined | null,
  {
    managerHatId,
    ipfsName,
  }: {
    managerHatId: string | number | bigint | undefined | null
    ipfsName?: string | null
  }
): string {
  if (isManagerHat(hatId, managerHatId)) return 'Manager'
  if (ipfsName) return ipfsName
  return 'Member'
}
