import { BigNumber } from 'ethers'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { Account } from 'thirdweb/wallets'

type ApproveTokenProps = {
  account: Account
  tokenContract: any
  spender: string
  allowance: BigNumber | undefined
}

type RevokeAllowanceProps = {
  account: Account
  tokenContract: any
  spender: string
}

export async function approveToken({
  account,
  tokenContract,
  spender,
  allowance,
}: ApproveTokenProps) {
  const transaction = prepareContractCall({
    contract: tokenContract,
    method: 'approve' as string,
    params: [spender, allowance],
  })

  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })

  return receipt
}

export async function revokeAllowance({
  account,
  tokenContract,
  spender,
}: RevokeAllowanceProps) {
  const transaction = prepareContractCall({
    contract: tokenContract,
    method: 'approve' as string,
    params: [spender, BigNumber.from('0')],
  })

  const receipt = await sendAndConfirmTransaction({
    transaction,
    account,
  })

  return receipt
}
