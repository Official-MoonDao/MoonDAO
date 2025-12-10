/**
 * Advanced search parser supporting:
 * - Exact word matching with quotes: "June"
 * - Phrase search: "town hall meeting"
 * - Boolean AND (default): term1 term2 or term1 AND term2
 * - Boolean OR: term1 OR term2
 * - Boolean NOT: -term or term1 NOT term2
 */
export function parseSearchQuery(query: string): {
  requiredTerms: string[]
  optionalTerms: string[]
  excludedTerms: string[]
  phrases: string[]
} {
  const requiredTerms: string[] = []
  const optionalTerms: string[] = []
  const excludedTerms: string[] = []
  const phrases: string[] = []

  // Extract phrases (quoted strings)
  const phraseMatches = query.matchAll(/"([^"]+)"/g)
  for (const match of phraseMatches) {
    phrases.push(match[1].toLowerCase())
  }

  // Remove phrases from query for further processing
  let remainingQuery = query.replace(/"[^"]+"/g, ' ')

  // Process the remaining query
  const tokens = remainingQuery.split(/\s+/).filter((t) => t.trim())
  let i = 0

  while (i < tokens.length) {
    const token = tokens[i].toLowerCase()

    // Skip empty tokens
    if (!token) {
      i++
      continue
    }

    // Handle NOT operator
    if (token === 'not' && i + 1 < tokens.length) {
      excludedTerms.push(tokens[i + 1].toLowerCase())
      i += 2
      continue
    }

    // Handle OR operator
    if (token === 'or') {
      // Previous term becomes optional if it was required
      if (requiredTerms.length > 0) {
        const prevTerm = requiredTerms.pop()
        if (prevTerm) optionalTerms.push(prevTerm)
      }
      // Next term is optional
      if (i + 1 < tokens.length) {
        optionalTerms.push(tokens[i + 1].toLowerCase())
        i += 2
      } else {
        i++
      }
      continue
    }

    // Handle AND operator (explicit, though it's default behavior)
    if (token === 'and') {
      i++
      continue
    }

    // Handle excluded terms (prefixed with -)
    if (token.startsWith('-') && token.length > 1) {
      excludedTerms.push(token.substring(1))
      i++
      continue
    }

    // Regular term (required by default)
    if (token !== 'or' && token !== 'and' && token !== 'not') {
      requiredTerms.push(token)
    }
    i++
  }

  return { requiredTerms, optionalTerms, excludedTerms, phrases }
}

/**
 * Checks if text matches the advanced search criteria
 */
export function matchesAdvancedSearch(text: string, searchQuery: string): boolean {
  const lowerText = text.toLowerCase()
  const { requiredTerms, optionalTerms, excludedTerms, phrases } = parseSearchQuery(searchQuery)

  // Check excluded terms first (if any match, return false)
  for (const term of excludedTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i')
    if (regex.test(lowerText)) {
      return false
    }
  }

  // Check required phrases (all must match)
  for (const phrase of phrases) {
    if (!lowerText.includes(phrase)) {
      return false
    }
  }

  // Check required terms (all must match as whole words)
  for (const term of requiredTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'i')
    if (!regex.test(lowerText)) {
      return false
    }
  }

  // Check optional terms (at least one must match if any are specified)
  if (optionalTerms.length > 0) {
    const hasMatch = optionalTerms.some((term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'i')
      return regex.test(lowerText)
    })
    if (!hasMatch) {
      return false
    }
  }

  return true
}
