import { useEffect, useState } from 'react'

function parseBudgetFromSection(text: string): number {
  const totalMatch = text.match(
    /\|\s*(?:#{0,3}\s*)?[Tt]otal\s*:?\s*\|\s*(?:#{0,3}\s*)?\$?([\d,]+(?:\.\d+)?)/
  )
  if (totalMatch) {
    return parseFloat(totalMatch[1].replace(/,/g, '')) || 0
  }

  let sum = 0
  const rowPattern =
    /\|\s*[^|]+\|\s*(?:#{0,3}\s*)?\$?([\d,]+(?:\.\d+)?)\s*(?:USDC|DAI|USD)?\s*\|/g
  let match
  while ((match = rowPattern.exec(text)) !== null) {
    if (/---/.test(match[0])) continue
    sum += parseFloat(match[1].replace(/,/g, '')) || 0
  }
  return sum
}

function parseUsdBudgetFromBody(body: string): number {
  const budgetHeading = body.match(/^#{1,3}\s+Budget\s*(?:\(.*?\))?\s*$/im)
  if (budgetHeading && budgetHeading.index !== undefined) {
    const sectionStart = budgetHeading.index + budgetHeading[0].length
    const nextHeading = body.slice(sectionStart).search(/^#{1,2}\s+(?!#)/m)
    const section =
      nextHeading !== -1
        ? body.slice(sectionStart, sectionStart + nextHeading)
        : body.slice(sectionStart)
    const result = parseBudgetFromSection(section)
    if (result > 0) return result
  }

  const totalMatch = body.match(
    /\|\s*(?:#{0,3}\s*)?[Tt]otal\s*:?\s*\|\s*(?:#{0,3}\s*)?\$?([\d,]+(?:\.\d+)?)/
  )
  if (totalMatch) {
    return parseFloat(totalMatch[1].replace(/,/g, '')) || 0
  }

  return 0
}

export default function useProposalJSON(project: any) {
  const [proposalJSON, setProposalJSON] = useState<any>()
  useEffect(() => {
    async function fetchData() {
      const proposalResponse = await fetch(project.proposalIPFS)
      const proposal = await proposalResponse.json()

      let usdBudget = 0

      if (proposal.totalBudgetUSDC != null) {
        usdBudget = Number(proposal.totalBudgetUSDC) || 0
      } else if (proposal.budget && Array.isArray(proposal.budget)) {
        proposal.budget.forEach((item: any) => {
          if (item.token === 'USD' || item.token === 'USDC' || item.token === 'USDT' || item.token === 'DAI') {
            usdBudget += Number(item.amount) || 0
          }
        })
      }

      if (usdBudget === 0 && proposal.body) {
        usdBudget = parseUsdBudgetFromBody(proposal.body)
      }

      proposal.usdBudget = usdBudget
      setProposalJSON(proposal)
    }
    fetchData()
  }, [project])

  return proposalJSON
}
