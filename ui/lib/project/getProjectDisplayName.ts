import type { Project } from '@/lib/project/useProjectData'

const UNTITLED_FALLBACK = 'Untitled Project'

const UNTITLED_PATTERN = /^\s*untitled\b/i

function isUntitledLike(value: string | undefined | null): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true
  return UNTITLED_PATTERN.test(trimmed)
}

function cleanLine(line: string): string {
  return line
    .replace(/^\s*#+\s*/, '')
    .replace(/^\s*\*+\s*/, '')
    .replace(/\*{1,3}/g, '')
    .replace(/^\s*>+\s*/, '')
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim()
}

function hasMeaningfulText(line: string): boolean {
  return /[A-Za-z0-9]/.test(line)
}

function isTemplateBoilerplate(line: string): boolean {
  if (!line) return true
  if (/^author\s*:/i.test(line)) return true
  if (/^date\s*:/i.test(line)) return true
  if (/^title\s*:\s*$/i.test(line)) return true
  if (/^please\s+read\b/i.test(line)) return true
  if (/^moondao\s+projects?\s+template\b/i.test(line)) return true
  if (/^moondao\s+project\s+proposal\s*:?\s*$/i.test(line)) return true
  if (/^make\s+a\s+copy\s+of\s+this\b/i.test(line)) return true
  if (
    /^(abstract|problem|solution|benefits?|risks?|objectives?|team|timeline|budget|scope\s+of\s+work)\s*:?\s*$/i.test(
      line
    )
  )
    return true
  return false
}

function extractTitleFromBody(body: string | undefined | null): string | null {
  if (!body) return null

  const h1Regex = /^\s*#\s+(.+?)\s*$/m
  const h1Match = body.match(h1Regex)
  const h1Title = h1Match?.[1]?.trim() || null

  if (h1Title && !isUntitledLike(h1Title)) return h1Title

  const afterH1Index =
    h1Match && h1Match.index !== undefined
      ? h1Match.index + h1Match[0].length
      : 0
  const rest = body.slice(afterH1Index)

  const lines = rest.split(/\r?\n/)
  for (const raw of lines) {
    let line = cleanLine(raw)
    if (!line) continue
    if (!hasMeaningfulText(line)) continue
    if (isTemplateBoilerplate(line)) continue
    if (isUntitledLike(line)) continue
    line = line.replace(/^title\s*:\s*/i, '').trim()
    if (!line || !hasMeaningfulText(line) || isUntitledLike(line)) continue
    if (line.length > 200) return line.slice(0, 200).trim()
    return line
  }

  return h1Title
}

export function getProjectDisplayName(
  project: Partial<Project> | undefined | null,
  proposalJSON?: { title?: string; body?: string } | null
): string {
  const rawName = (project?.name || '').trim()
  if (rawName && !isUntitledLike(rawName)) return rawName

  const proposalTitle =
    typeof proposalJSON?.title === 'string' ? proposalJSON.title.trim() : ''
  if (proposalTitle && !isUntitledLike(proposalTitle)) return proposalTitle

  const bodyTitle = extractTitleFromBody(proposalJSON?.body)
  if (bodyTitle && !isUntitledLike(bodyTitle)) return bodyTitle

  return rawName && !isUntitledLike(rawName) ? rawName : UNTITLED_FALLBACK
}
