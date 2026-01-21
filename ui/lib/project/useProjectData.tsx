//This hook fetches all project data based on a project tableland entry (not an NFT)
import { useEffect, useMemo, useState } from 'react'
import { readContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { PROJECT_ACTIVE } from '@/lib/nance/types'

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
  tempCheckApproved?: string
}

export default function useProjectData(
  projectContract: any,
  hatsContract: any,
  project: Project | undefined
) {
  const account = useActiveAccount()
  const address = account?.address

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const [isManager, setIsManager] = useState<boolean>(false)
  const [hatTreeId, setHatTreeId] = useState<any>()

  const [adminHatId, setAdminHatId] = useState<any>()
  const [managerHatId, setManagerHatId] = useState<any>()

  const [finalReportMarkdown, setFinalReportMarkdown] = useState<string>()
  const [totalBudget, setTotalBudget] = useState<number>()

  useEffect(() => {
    async function getProposalJSON() {
      if (!project?.proposalIPFS) {
        return
      }
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()
      let budget = 0
      if (proposal.budget) {
        proposal.budget.forEach((item: any) => {
          budget += item.token === 'ETH' ? Number(item.amount) : 0
        })
        setTotalBudget(budget)
      }
    }
    if (project?.proposalIPFS) getProposalJSON()
  }, [project?.proposalIPFS])

  const isActive = useMemo(() => {
    return project?.active === PROJECT_ACTIVE
  }, [project])

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

      const adminHID = results[0].status === 'fulfilled' ? results[0].value : null
      const managerHID = results[1].status === 'fulfilled' ? results[1].value : null

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
    finalReportMarkdown,
    totalBudget,
    isLoading,
  }
}
