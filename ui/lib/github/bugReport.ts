export const BUG_REPORT_REPO_URL = 'https://github.com/Official-MoonDao/MoonDAO/issues/new'

export type BugReportContext = {
  pageUrl: string
  environment: string
}

// Query strings and fragments can carry one-time secrets such as the citizen
// invite token (`/citizen?invite=<token>`), which must never reach a public issue.
export function stripBugReportPageUrl(pageUrl: string): string {
  return pageUrl.split(/[?#]/)[0]
}

export function buildBugReportHref({ pageUrl, environment }: BugReportContext): string {
  const params = new URLSearchParams({
    template: 'bug_report.yml',
    title: '[Bug]: ',
    'page-url': stripBugReportPageUrl(pageUrl),
    environment,
  })
  return `${BUG_REPORT_REPO_URL}?${params.toString()}`
}

export function formatBugReportEnvironment({
  chain,
  viewport,
  userAgent,
}: {
  chain: string
  viewport?: string
  userAgent?: string
}): string {
  const lines = [`Network: ${chain}`]
  if (viewport) lines.push(`Viewport: ${viewport}`)
  if (userAgent) lines.push(`User agent: ${userAgent}`)
  return lines.join('\n')
}
