//This hook fetches all project data based on a project tableland entry (not an NFT)
import { useProposal } from '@nance/nance-hooks'
import { useEffect, useMemo, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { NANCE_SPACE_NAME } from '../nance/constants'
import useProposalJSON from '../nance/useProposalJSON'
import { PROJECT_ACTIVE} from '@/lib/nance/types'

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
  const account = useActiveAccount()
  const address = account?.address

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const { data: nanceProposalResponse } = useProposal({
    space: NANCE_SPACE_NAME,
    uuid: String(project?.MDP) || '',
  })
  const nanceProposal = nanceProposalResponse?.data

  //const proposalJSON = useProposalJSON(nanceProposal?.body as string)

  const [isManager, setIsManager] = useState<boolean>(false)
  const [hatTreeId, setHatTreeId] = useState<any>()

  const [adminHatId, setAdminHatId] = useState<any>()
  const [managerHatId, setManagerHatId] = useState<any>()

  const [finalReportMarkdown, setFinalReportMarkdown] = useState<string>()
  const [proposalJSON, setProposalJSON] = useState<string>()

  const isActive = useMemo(() => {
    return project?.active === PROJECT_ACTIVE
  }, [project])

  const totalBudget = useMemo(() => {
    let budget = 0
    if (nanceProposal?.actions && nanceProposal.actions.length > 0) {
      nanceProposal.actions.forEach((action: any) => {
        if (action.type === 'Request Budget') {
          action.payload.budget.forEach(
            (b: any) => (budget += b.token === 'ETH' ? Number(b.amount) : 0)
          )
        }
      })
    }
    return budget
  }, [nanceProposal])

  useEffect(() => {
    async function getFinalReportMarkdown() {
      const res = await fetch(
        `https://ipfs.io/ipfs/${project?.finalReportIPFS.split('ipfs://')[1]}`
      )
      const markdown = await res.text()
      setFinalReportMarkdown(markdown)
    }
    if (project?.finalReportIPFS) getFinalReportMarkdown()
  }, [project?.finalReportIPFS])

  useEffect(() => {
    async function checkManager() {
      try {
        if (address) {
          const isAddressManager: any = await readContract({
            contract: projectContract,
            method: 'isManager' as string,
            params: [project?.id, address],
          })
          const owner: any = await readContract({
            contract: projectContract,
            method: 'ownerOf' as string,
            params: [project?.id],
          })
          setIsManager(isAddressManager || owner === address)
        } else {
          setIsManager(false)
        }
      } catch (err) {
        setIsManager(false)
      }
    }
    async function getHats() {
      const results = await Promise.allSettled([
        readContract({
          contract: projectContract,
          method: 'teamAdminHat' as string,
          params: [project?.id || ''],
        }),
        readContract({
          contract: projectContract,
          method: 'teamManagerHat' as string,
          params: [project?.id || ''],
        }),
      ])

      const adminHID =
        results[0].status === 'fulfilled' ? results[0].value : null
      const managerHID =
        results[1].status === 'fulfilled' ? results[1].value : null

      setAdminHatId(adminHID)
      setManagerHatId(managerHID)
    }

    if (projectContract) {
      checkManager()
      getHats()
    }
  }, [address, project, projectContract])

  useEffect(() => {
    async function getHatTreeId() {
      const hatTreeId = await readContract({
        contract: hatsContract,
        method: 'getTopHatDomain' as string,
        params: [adminHatId],
      })
      setHatTreeId(hatTreeId)
    }
    if (hatsContract && adminHatId) getHatTreeId()
  }, [adminHatId, hatsContract])

  return {
    ...project,
    isManager,
    isActive,
    hatTreeId,
    adminHatId,
    managerHatId,
    nanceProposal,
    proposalJSON,
    finalReportMarkdown,
    totalBudget,
    isLoading,
  }
}
