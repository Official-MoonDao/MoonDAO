//JSONify the proposal sections
import { useEffect, useState } from 'react'
import { removeMarkdownFormatting } from '../utils/strings'

export default function useProposalJSON(proposalMarkdown: string) {
  const [proposalJSON, setProposalJSON] = useState<any>()

  useEffect(() => {
    if (!proposalMarkdown) return

    // Parse the markdown into sections
    const sections = proposalMarkdown.split(/\n#+\s*/).filter(Boolean)

    const parsedSections: Record<string, string> = {}

    sections.forEach((section) => {
      const [title, ...content] = section.split('\n')
      // Clean up the title and content
      const cleanTitle = removeMarkdownFormatting(title.trim()).trim()
      const cleanContent = removeMarkdownFormatting(content.join('\n').trim())

      if (cleanTitle && cleanContent) {
        parsedSections[cleanTitle.toLowerCase()] = cleanContent
      }
    })

    setProposalJSON(parsedSections)
  }, [proposalMarkdown])

  return proposalJSON
}
