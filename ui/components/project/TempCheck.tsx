import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useActiveAccount } from 'thirdweb/react'
import ProposalsABI from 'const/abis/Proposals.json'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import useProposalData from '@/lib/project/useProposalData'
import { PROPOSALS_ADDRESSES } from 'const/config'

type TempCheckProps = {
  mdp: number
}

export default function TempCheck({ mdp }: TempCheckProps) {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const proposalContract = useContract({
    address: PROPOSALS_ADDRESSES[chainSlug],
    chain: chain,
    abi: ProposalsABI.abi as any,
  })
  const { proposalData, isLoading, refetch } = useProposalData(proposalContract, mdp)
  const handleSubmit = (pass: boolean) => {
    return async () => {
      if (!account) {
        return
      }
      const transaction = prepareContractCall({
        contract: proposalContract,
        method: 'voteTempCheck' as string,
        params: [mdp, pass],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      refetch()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 mr-1">Temp Check:</span>
      <PrivyWeb3Button
        action={handleSubmit(true)}
        requiredChain={DEFAULT_CHAIN_V5}
        className="rounded-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-3 py-1.5 text-xs font-medium transition-all"
        label={
          '👍 ' +
          ('tempCheckApprovalCount' in proposalData
            ? proposalData?.tempCheckApprovalCount?.toString()
            : '0')
        }
      />
      <PrivyWeb3Button
        action={handleSubmit(false)}
        requiredChain={DEFAULT_CHAIN_V5}
        className="rounded-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-3 py-1.5 text-xs font-medium transition-all"
        label={
          '👎 ' +
          ('tempCheckApprovalCount' in proposalData
            ? (proposalData?.tempCheckVoteCount - proposalData?.tempCheckApprovalCount)?.toString()
            : '0')
        }
      />
    </div>
  )
}
