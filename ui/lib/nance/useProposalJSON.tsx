//jSONify the proposal sections
import { useEffect, useState } from 'react'

export default function useProposalJSON(proposalMarkdown: string) {
  const [proposalJSON, setProposalJSON] = useState<any>()

  useEffect(() => {
    if (!proposalMarkdown) return

    // Parse the markdown into sections
    const sections = proposalMarkdown.split('## ').filter(Boolean)
    const parsedSections: Record<string, string> = {}

    sections.forEach((section) => {
      const [title, ...content] = section.split('\n')
      // Clean up the title and content
      const cleanTitle = title.trim()
      const cleanContent = content.join('\n').trim()

      if (cleanTitle && cleanContent) {
        parsedSections[cleanTitle.toLowerCase()] = cleanContent
      }
    })

    setProposalJSON(parsedSections)
  }, [proposalMarkdown])

  return proposalJSON
}
