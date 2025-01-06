import { useEffect, useState } from 'react'
import useProposalJSON from '../nance/useProposalJSON'

export type Project = {
  id: string
  title: string
  proposalIPFS: string
  rewardDistribution: { [key: string]: number }
  finalReportLink: string
  eligible: number
  MDP: number
}

export default function useProjectData(project: Project) {
  const [proposal, setProposal] = useState<any>()
  const proposalJSON = useProposalJSON(proposal?.data?.message?.body as string)
  const [lead, setLead] = useState<string | undefined>()

  useEffect(() => {
    async function getProposal() {
      const res = await fetch(
        `https://ipfs.io/ipfs/${project?.proposalIPFS.split('ipfs://')[1]}`
      )
      const data = await res.json()
      setProposal(data)
    }
    if (project?.proposalIPFS) getProposal()
  }, [project])

  return { snapshotData: proposal, proposalJSON }
}
