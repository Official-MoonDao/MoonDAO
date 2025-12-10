// Processes HTML content from ConvertKit broadcasts
export function cleanSummaryContent(content: string): string {
  if (!content) return ''

  // Remove style tags and their content
  let cleaned = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Remove script tags and their content
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

  // Remove the h1 tag (Town Hall Summary)
  // This is redundant since the card title already shows this
  cleaned = cleaned.replace(/<h1[^>]*>.*?<\/h1>/gi, '')

  // Remove the auto-generation footer note if present
  cleaned = cleaned.replace(/<p><em>This summary was automatically generated.*?<\/em><\/p>/gi, '')

  // Remove the hr tag if it's at the end (leftover from removed footer)
  cleaned = cleaned.replace(/<hr\s*\/?>\s*$/gi, '')

  // Clean up extra whitespace but preserve intentional spacing
  cleaned = cleaned.trim()

  return cleaned
}

// Extracts preview text from HTML content
export function getPreviewText(content: string, maxLength: number = 200): string {
  if (!content) return ''

  // Remove HTML tags for preview
  const textOnly = content.replace(/<[^>]*>/g, '').trim()

  if (textOnly.length <= maxLength) {
    return textOnly
  }

  // Find the last space before maxLength to avoid cutting words
  const truncated = textOnly.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...'
}
