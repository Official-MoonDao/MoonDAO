//This hook fetches all project data based on a project tableland entry (not an NFT)
import { useProposal } from '@nance/nance-hooks'
import { useAddress } from '@thirdweb-dev/react'
import { useEffect, useMemo, useState } from 'react'
import { NANCE_SPACE_NAME } from '../nance/constants'
import useProposalJSON from '../nance/useProposalJSON'
import { useHandleRead } from '../thirdweb/hooks'

export type Project = {
  MDP: number
  active: number
  description: string
  eligible: number
  finalReportIPFS: string
  finalReportLink: string
  id: number
  image: string
  name: string
  proposalIPFS: string
  proposalLink: string
  quarter: number
  rewardDistribution: string
  upfrontPayments: string
  year: number
}

export default function useProjectData(
  projectContract: any,
  hatsContract: any,
  project: Project | undefined
) {
  const address = useAddress()

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const { data: nanceProposalResponse } = useProposal({
    space: NANCE_SPACE_NAME,
    uuid: String(project?.MDP) || '',
  })
  const nanceProposal = nanceProposalResponse?.data

  const proposalJSON = useProposalJSON(nanceProposal?.body as string)

  const [isManager, setIsManager] = useState<boolean>(false)
  const [hatTreeId, setHatTreeId] = useState<string>()

  const { data: adminHatId } = useHandleRead(projectContract, 'teamAdminHat', [
    project?.id || '',
  ])

  const { data: managerHatId } = useHandleRead(
    projectContract,
    'teamManagerHat',
    [project?.id || '']
  )

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
    async function checkManager() {
      try {
        if (address) {
          const isAddressManager = await projectContract.call('isManager', [
            project?.id,
            address,
          ])
          const owner = await projectContract.call('ownerOf', [project?.id])
          setIsManager(isAddressManager || owner === address)
        } else {
          setIsManager(false)
        }
      } catch (err) {
        setIsManager(false)
      }
    }
    if (projectContract && project?.id) checkManager()
  }, [address, project, projectContract])

  useEffect(() => {
    async function getHatTreeId() {
      const hatTreeId = await hatsContract.call('getTopHatDomain', [adminHatId])

      setHatTreeId(hatTreeId)
    }
    if (hatsContract && adminHatId) getHatTreeId()
  }, [adminHatId, hatsContract])

  return {
    ...project,
    isManager,
    hatTreeId,
    adminHatId,
    managerHatId,
    nanceProposal,
    proposalJSON,
    totalBudget,
    isLoading,
  }
}
