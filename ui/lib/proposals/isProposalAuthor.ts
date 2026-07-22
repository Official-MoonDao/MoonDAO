/**
 * Authorization helper for proposal update/delete.
 *
 * A proposal may only be modified (edited or withdrawn via the `deleted` flag)
 * by its recorded author. The author is derived from the CURRENT on-chain
 * `proposalIPFS` JSON (`authorAddress`) — never from caller-supplied input.
 *
 * Fails CLOSED: returns false when either the current author or the caller
 * address is missing / malformed, so a proposal whose author cannot be
 * established can't be modified by an arbitrary authenticated user.
 */
export function isProposalAuthor(
  currentAuthorAddress: unknown,
  callerAddress: unknown
): boolean {
  if (typeof currentAuthorAddress !== 'string' || currentAuthorAddress === '') {
    return false
  }
  if (typeof callerAddress !== 'string' || callerAddress === '') {
    return false
  }
  return currentAuthorAddress.toLowerCase() === callerAddress.toLowerCase()
}
