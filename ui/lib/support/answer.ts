export const PERSON = 'A person needs to answer this.'

const ESCALATE = [
  'my balance',
  'my funds',
  'refund',
  'eligib',
  'legal',
  'lawsuit',
  'sanction',
  'ofac',
  'can i bet',
  'am i allowed',
]

export type SupportDoc = { path: string; body: string }

export type SupportAnswer = {
  outcome: 'answered' | 'escalated'
  path: string | null
  text: string
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length >= 4)
}

export function answerQuestion(question: string, docs: SupportDoc[]): SupportAnswer {
  const folded = question.toLowerCase()
  if (ESCALATE.some((marker) => folded.includes(marker))) {
    return { outcome: 'escalated', path: null, text: PERSON }
  }
  const questionWords = words(question)
  let bestScore = 0
  let bestPath: string | null = null
  let bestText = ''
  for (const doc of docs) {
    for (const raw of doc.body.trim().split(/\n\s*\n/)) {
      const paragraph = raw.trim()
      if (!paragraph) continue
      const haystack = new Set(words(paragraph))
      const score = questionWords.reduce((count, word) => count + (haystack.has(word) ? 1 : 0), 0)
      if (score > bestScore) {
        bestScore = score
        bestPath = doc.path
        bestText = paragraph
      }
    }
  }
  if (bestScore === 0) {
    return { outcome: 'escalated', path: null, text: PERSON }
  }
  return { outcome: 'answered', path: bestPath, text: bestText }
}
