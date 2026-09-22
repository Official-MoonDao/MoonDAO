import { JB_NATIVE_TOKEN_ADDRESS, JBV5_TERMINAL_ADDRESS } from 'const/config'
import { getContract, prepareContractCall } from 'thirdweb'

export type JBPayParams = {
  projectId: number
  token: string
  amountWei: bigint
  beneficiary: string
  minReturnedTokens: bigint
  memo: string
  metadata: `0x${string}`
}

export function buildJBPayParams(opts: {
  projectId: number
  token?: string
  amountWei: bigint
  beneficiary: string
  minReturnedTokens: bigint
  memo: string
  metadata?: `0x${string}`
}): { params: JBPayParams; value: bigint; terminalAddress: string } {
  return {
    terminalAddress: JBV5_TERMINAL_ADDRESS,
    value: opts.amountWei,
    params: {
      projectId: opts.projectId,
      token: opts.token || JB_NATIVE_TOKEN_ADDRESS,
      amountWei: opts.amountWei,
      beneficiary: opts.beneficiary,
      minReturnedTokens: opts.minReturnedTokens,
      memo: opts.memo,
      metadata: opts.metadata ?? '0x00',
    },
  }
}

const PAY_ABI = [
  {
    type: 'function',
    name: 'pay',
    stateMutability: 'payable',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'minReturnedTokens', type: 'uint256' },
      { name: 'memo', type: 'string' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

export function prepareJBPay(opts: {
  client: any
  chain: any
  terminalAddress?: string
  projectId: number
  token?: string
  amountWei: bigint
  beneficiary: string
  minReturnedTokens: bigint
  memo: string
  metadata?: `0x${string}`
}) {
  const built = buildJBPayParams(opts)
  const contract = getContract({
    client: opts.client,
    chain: opts.chain,
    address: opts.terminalAddress || built.terminalAddress,
    abi: PAY_ABI as any,
  })
  const p = built.params
  return prepareContractCall({
    contract,
    method: 'pay',
    params: [
      BigInt(p.projectId),
      p.token,
      p.amountWei,
      p.beneficiary,
      p.minReturnedTokens,
      p.memo,
      p.metadata,
    ],
    value: built.value,
  })
}
