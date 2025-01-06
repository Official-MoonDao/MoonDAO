import { useProposal } from '@nance/nance-hooks'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useMemo, useState } from 'react'
import { NANCE_SPACE_NAME } from '../nance/constants'
import useProposalJSON from '../nance/useProposalJSON'
import { useHandleRead } from '../thirdweb/hooks'
import { getAttribute } from '../utils/nft'

export type Project = {
  id: string
  title: string
  proposalIPFS: string
  rewardDistribution: { [key: string]: number }
  finalReportLink: string
  eligible: number
  MDP: number
}

export default function useProjectData(
  projectContract: any,
  hatsContract: any,
  nft: any
) {
  const address = useAddress()

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const [snapshotProposal, setSnapshotProposal] = useState<any>()
  const proposalJSON = useProposalJSON(
    snapshotProposal?.data?.message?.body as string
  )

  const [lead, setLead] = useState<string | undefined>()
  const [isManager, setIsManager] = useState<boolean>(false)
  const [hatTreeId, setHatTreeId] = useState<string>()

  const { data: adminHatId } = useHandleRead(projectContract, 'teamAdminHat', [
    nft?.metadata?.id || '',
  ])

  const { data: managerHatId } = useHandleRead(
    projectContract,
    'teamManagerHat',
    [nft?.metadata?.id || '']
  )

  const isActive = useMemo(() => {
    const active = getAttribute(nft?.metadata?.attributes, 'active')?.value
    return active === 'true'
  }, [nft?.metadata?.attributes])

  const proposalIPFS = useMemo(() => {
    const proposalIPFS = getAttribute(
      nft?.metadata?.attributes,
      'proposalIPFS'
    )?.value
    return proposalIPFS
  }, [nft?.metadata?.attributes])

  const finalReportIPFS = useMemo(() => {
    const finalReportIPFS = getAttribute(
      nft?.metadata?.attributes,
      'finalReportIPFS'
    )?.value
    return finalReportIPFS
  }, [nft?.metadata?.attributes])
  const [finalReport, setFinalReport] = useState<string | undefined>()

  const MDP = useMemo(() => {
    const MDP = getAttribute(nft?.metadata?.attributes, 'MDP')?.value
    return MDP
  }, [nft?.metadata?.attributes])

  const { data: nanceProposalResponse } = useProposal({
    space: NANCE_SPACE_NAME,
    uuid: MDP,
  })
  const nanceProposal = nanceProposalResponse?.data

  const totalBudget = useMemo(() => {
    let budget = 0
    if (nanceProposal?.actions && nanceProposal.actions.length > 0) {
      nanceProposal.actions.forEach((action: any) => {
        if (action.type === 'Request Budget') {
          action.payload.budget.forEach(
            (b: any) => (budget += Number(b.amount))
          )
        }
      })
    }
    return budget
  }, [nanceProposal])

  useEffect(() => {
    async function getProposal() {
      const res = await fetch(
        `https://ipfs.io/ipfs/${proposalIPFS.split('ipfs://')[1]}`
      )
      const data = await res.json()
      setSnapshotProposal(data)
    }
    if (proposalIPFS) getProposal()
  }, [proposalIPFS])

  useEffect(() => {
    async function checkManager() {
      try {
        if (address) {
          const isAddressManager = await projectContract.call('isManager', [
            nft?.metadata?.id,
            address,
          ])
          setIsManager(isAddressManager || nft.owner === address)
        } else {
          setIsManager(false)
        }
      } catch (err) {
        setIsManager(false)
      }
    }
    if (projectContract && nft?.metadata?.id) checkManager()
  }, [address, nft, projectContract])

  useEffect(() => {
    async function getHatTreeId() {
      const hatTreeId = await hatsContract.call('getTopHatDomain', [adminHatId])

      setHatTreeId(hatTreeId)
    }
    if (hatsContract && adminHatId) getHatTreeId()
  }, [adminHatId, hatsContract])

  return {
    isActive,
    isManager,
    MDP,
    hatTreeId,
    adminHatId,
    managerHatId,
    snapshotData: snapshotProposal,
    nanceProposal,
    proposalJSON,
    totalBudget,
    isLoading,
  }
}
