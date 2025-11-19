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
    <div className="m-4">
      <p className="text-sm text-blue-400 font-medium">🤔 Proposal</p>
      <div>Temp check</div>
      <PrivyWeb3Button
        action={handleSubmit(true)}
        requiredChain={DEFAULT_CHAIN_V5}
        className="rounded-full bg-red-500 hover:bg-red-600 mr-2"
        label={
          '👍' +
          ('tempCheckApprovalCount' in proposalData
            ? proposalData?.tempCheckApprovalCount?.toString()
            : '')
        }
      />
      <PrivyWeb3Button
        action={handleSubmit(false)}
        requiredChain={DEFAULT_CHAIN_V5}
        className="rounded-full bg-red-500 hover:bg-red-600"
        label={
          '👎' +
          ('tempCheckApprovalCount' in proposalData
            ? (proposalData?.tempCheckVoteCount - proposalData?.tempCheckApprovalCount)?.toString()
            : '')
        }
      />
    </div>
  )
}
