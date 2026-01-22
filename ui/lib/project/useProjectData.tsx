//This hook fetches all project data based on a project tableland entry (not an NFT)
import { useEffect, useMemo, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import ProjectABI from 'const/abis/Project.json'
import HatsABI from 'const/abis/Hats.json'
import { engineMulticall, EngineReadParams } from '@/lib/thirdweb/engine'

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
    async function fetchProjectContractData() {
      if (!projectContract?.address || !projectContract?.chain?.id || !project?.id) {
        setIsManager(false)
        return
      }

      setIsLoading(true)
      try {
        const contractAddress = projectContract.address
        const chainId = projectContract.chain.id

        const params: EngineReadParams[] = [
          {
            contractAddress,
            method: 'teamAdminHat',
            params: [project.id],
            abi: ProjectABI,
          },
          {
            contractAddress,
            method: 'teamManagerHat',
            params: [project.id],
            abi: ProjectABI,
          },
        ]

        // Only add manager check params if address is available
        if (address) {
          params.push(
            {
              contractAddress,
              method: 'isManager',
              params: [project.id, address],
              abi: ProjectABI,
            },
            {
              contractAddress,
              method: 'ownerOf',
              params: [project.id],
              abi: ProjectABI,
            }
          )
        }

        const results = await engineMulticall<{ result: any }>(params, { chainId })

        // Set hat IDs
        setAdminHatId(results[0]?.result ?? null)
        setManagerHatId(results[1]?.result ?? null)

        // Set manager status if address was provided
        if (address && results.length >= 4) {
          const isAddressManager = results[2]?.result
          const owner = results[3]?.result
          setIsManager(isAddressManager || owner === address)
        } else {
          setIsManager(false)
        }
      } catch (error) {
        console.error('Failed to fetch project contract data:', error)
        setIsManager(false)
        setAdminHatId(null)
        setManagerHatId(null)
      } finally {
        setIsLoading(false)
      }
    }

    if (projectContract) {
      fetchProjectContractData()
    }
  }, [address, project, projectContract])

  useEffect(() => {
    async function getHatTreeId() {
      if (!hatsContract?.address || !hatsContract?.chain?.id || !adminHatId) return

      try {
        const params: EngineReadParams[] = [
          {
            contractAddress: hatsContract.address,
            method: 'getTopHatDomain',
            params: [adminHatId],
            abi: HatsABI,
          },
        ]

        const results = await engineMulticall<{ result: any }>(params, {
          chainId: hatsContract.chain.id,
        })

        setHatTreeId(results[0]?.result)
      } catch (error) {
        console.error('Failed to fetch hat tree ID:', error)
      }
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
