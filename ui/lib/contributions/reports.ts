import fs from 'fs'
import path from 'path'

// Quarterly senate contribution reviews. Each cycle is one HTML file generated
// in a separate repo (CSV_to_PDF) and committed unchanged as
// content/contributions/<year>-q<n>.html. The page at /contributions/<cycle>
// lifts the report's body out of that file and renders it inside the site
// layout; the file's own <style> and <script> are dropped in favour of
// ContributionReport's styling and behaviour.
export const CONTRIBUTION_REPORTS_ROOT = path.join(process.cwd(), 'content', 'contributions')

const CYCLE_PATTERN = /^\d{4}-q[1-4]$/

export type ContributionReport = {
  cycle: string
  eyebrow: string
  title: string
  lede: string
  /** Inner HTML of the report's <main>, minus its <header> and <footer>. */
  bodyHtml: string
  footnote: string
}

export function allContributionCycles(root = CONTRIBUTION_REPORTS_ROOT): string[] {
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.slice(0, -'.html'.length))
    .filter((cycle) => CYCLE_PATTERN.test(cycle))
    .sort()
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstMatch(html: string, re: RegExp): string {
  return re.exec(html)?.[1] ?? ''
}

export function parseContributionReport(cycle: string, raw: string): ContributionReport {
  const html = raw.replace(/\r\n/g, '\n')
  const main = firstMatch(html, /<main>([\s\S]*)<\/main>/) || firstMatch(html, /<body>([\s\S]*)<\/body>/)
  const header = firstMatch(main, /<header>([\s\S]*?)<\/header>/)
  const footer = firstMatch(main, /<footer>([\s\S]*?)<\/footer>/)

  return {
    cycle,
    eyebrow: textOf(firstMatch(header, /<div class="eyebrow">([\s\S]*?)<\/div>/)),
    title:
      textOf(firstMatch(header, /<h1>([\s\S]*?)<\/h1>/)) ||
      textOf(firstMatch(html, /<title>([\s\S]*?)<\/title>/)),
    lede: textOf(firstMatch(header, /<p class="lede">([\s\S]*?)<\/p>/)),
    bodyHtml: main
      .replace(/<header>[\s\S]*?<\/header>/, '')
      .replace(/<footer>[\s\S]*?<\/footer>/, '')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .trim(),
    footnote: textOf(footer),
  }
}

export function getContributionReport(
  cycle: string,
  root = CONTRIBUTION_REPORTS_ROOT
): ContributionReport | null {
  if (!CYCLE_PATTERN.test(cycle)) return null
  const file = path.join(root, `${cycle}.html`)
  if (!fs.existsSync(file)) return null
  return parseContributionReport(cycle, fs.readFileSync(file, 'utf8'))
}
