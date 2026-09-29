import { JB_NATIVE_TOKEN_ADDRESS, JB_NATIVE_TOKEN_ID } from 'const/config'

/** Juicebox v5 projects NFT. Same address on the chains this app uses. */
export const JB_PROJECTS_ADDRESS = '0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4'

/**
 * Arguments for `JBMultiTerminal.useAllowanceOf`.
 * Ruleset 0 of a DePrize mission has a surplus allowance denominated in ETH
 * (`uint32(uint160(native token))`, which is `JB_NATIVE_TOKEN_ID`). The locked
 * payout split cannot name a winner chosen later; this call can.
 */
export function allowanceOfParams(opts: {
  projectId: bigint
  amountWei: bigint
  beneficiary: string
}): readonly unknown[] {
  return [
    opts.projectId,
    JB_NATIVE_TOKEN_ADDRESS,
    opts.amountWei,
    BigInt(JB_NATIVE_TOKEN_ID),
    0n,
    opts.beneficiary,
    '0x0000000000000000000000000000000000000000',
    'DePrize prize payout',
  ]
}
