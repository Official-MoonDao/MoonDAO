import { useEffect, useRef } from 'react'

type ContributionReportProps = {
  /** Report body from lib/contributions/reports.ts — trusted, committed HTML. */
  html: string
  footnote?: string
}

// Renders a generated quarterly contribution review inside the site layout.
// The generator's markup is kept as-is; its inline <style> and <script> are
// replaced by the styles below and the effect, which re-implements the
// report's search, category filter, expand/collapse and #hash handling. If
// the generator's class names or ids change, update both here.
export default function ContributionReport({ html, footnote }: ContributionReportProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const cleanups: Array<() => void> = []
    const on = (el: EventTarget | null, type: string, fn: EventListener) => {
      if (!el) return
      el.addEventListener(type, fn)
      cleanups.push(() => el.removeEventListener(type, fn))
    }

    // Links quoted from submissions leave the site; open them in a new tab.
    root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
    })

    const people = Array.from(root.querySelectorAll<HTMLElement>('.person'))
    const search = root.querySelector<HTMLInputElement>('#search')
    const flaggedOnly = root.querySelector<HTMLInputElement>('#flagged-only')
    const showing = root.querySelector<HTMLElement>('#showing')
    const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('.filter-chip'))
    let category: string | null = null

    const apply = () => {
      const q = (search?.value || '').trim().toLowerCase()
      let shown = 0
      for (const p of people) {
        const ok =
          (!q || (p.dataset.text || '').includes(q)) &&
          (!flaggedOnly?.checked || p.dataset.flagged === '1') &&
          (!category || (p.dataset.categories || '').split('|').includes(category))
        p.hidden = !ok
        if (ok) shown++
      }
      if (showing) {
        showing.textContent = shown === people.length ? '' : `Showing ${shown} of ${people.length}`
      }
    }
    on(search, 'input', apply)
    on(flaggedOnly, 'change', apply)
    for (const chip of chips) {
      on(chip, 'click', () => {
        category = category === chip.dataset.category ? null : chip.dataset.category || null
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.category === category)))
        apply()
        root.querySelector('#contributors')?.scrollIntoView({ behavior: 'smooth' })
      })
    }

    const entries = () => root.querySelectorAll<HTMLDetailsElement>('details.entry')
    on(root.querySelector('#expand-all'), 'click', () => entries().forEach((d) => (d.open = true)))
    on(root.querySelector('#collapse-all'), 'click', () => entries().forEach((d) => (d.open = false)))

    const openTarget = () => {
      if (!window.location.hash) return
      const id = decodeURIComponent(window.location.hash.slice(1))
      const el = root.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)
      if (el && el.tagName === 'DETAILS') {
        ;(el as HTMLDetailsElement).open = true
        el.scrollIntoView()
      }
    }
    on(window, 'hashchange', openTarget)
    on(window, 'beforeprint', () => entries().forEach((d) => (d.open = true)))
    openTarget()

    return () => cleanups.forEach((fn) => fn())
  }, [html])

  return (
    <div className="contribution-report">
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {footnote ? <p className="report-footnote">{footnote}</p> : null}
      <style jsx global>{`
        .contribution-report {
          --surface: rgba(255, 255, 255, 0.05);
          --surface-2: rgba(255, 255, 255, 0.04);
          --surface-hover: rgba(255, 255, 255, 0.1);
          --border: rgba(255, 255, 255, 0.1);
          --text: #ffffff;
          --muted: rgba(255, 255, 255, 0.6);
          --accent: #60a5fa;
          --accent-hover: #93c5fd;
          --amber-bg: rgba(245, 158, 11, 0.12);
          --amber-text: #fcd34d;
          --amber-border: rgba(245, 158, 11, 0.35);
          --ev-up-bg: rgba(16, 185, 129, 0.15);
          --ev-up-text: #6ee7b7;
          --ev-link-bg: rgba(59, 130, 246, 0.15);
          --ev-link-text: #93c5fd;
          --c-participation: #94a3b8;
          --c-outreach: #60a5fa;
          --c-content: #c084fc;
          --c-events: #2dd4bf;
          --c-research: #fb923c;
          --c-governance: #818cf8;
          --c-donation: #facc15;
          --c-other: #a1a1aa;
          --c-unreviewed: #64748b;
          color: var(--text);
          font-size: 15px;
          line-height: 1.6;
          padding-bottom: 64px;
          min-width: 0;
        }
        .contribution-report a {
          color: var(--accent);
        }
        .contribution-report a:hover {
          color: var(--accent-hover);
        }
        .contribution-report h2,
        .contribution-report h3 {
          font-family: Archivo, sans-serif;
          font-weight: 600;
          color: #fff;
          text-wrap: balance;
        }
        .contribution-report h2 {
          font-size: 20px;
          margin: 0 0 12px;
        }
        .contribution-report h3 {
          font-size: 18px;
          margin: 0;
        }
        .contribution-report section {
          margin-top: 24px;
        }
        .contribution-report section:first-child {
          margin-top: 0;
        }
        .contribution-report .muted {
          color: var(--muted);
        }

        .contribution-report .pool {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(147, 51, 234, 0.22));
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .contribution-report .pool-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .contribution-report .pool-amounts {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px 40px;
          margin: 6px 0;
        }
        .contribution-report .pool-amount {
          font-family: Archivo, sans-serif;
          font-size: 30px;
          font-weight: 600;
        }
        .contribution-report .pool-amount span {
          font-family: Lato, sans-serif;
          font-size: 14px;
          font-weight: 500;
          margin-left: 6px;
          color: var(--muted);
        }
        .contribution-report .pool p {
          margin: 0;
          font-size: 13px;
          color: var(--muted);
        }

        .contribution-report .guide,
        .contribution-report .breakdown,
        .contribution-report .person,
        .contribution-report .person-detail,
        .contribution-report .stat {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .contribution-report .guide,
        .contribution-report .breakdown {
          padding: 20px;
        }
        .contribution-report .guide ol {
          margin: 0 0 12px;
          padding-left: 20px;
          list-style: decimal;
        }
        .contribution-report .guide li {
          margin-bottom: 4px;
        }
        .contribution-report .policy {
          display: grid;
          gap: 8px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
        }
        .contribution-report .ai-note {
          font-size: 13px;
          color: var(--muted);
          margin: 12px 0 0;
        }
        .contribution-report .legend {
          margin-top: 12px;
          font-size: 14px;
        }
        .contribution-report .legend summary {
          cursor: pointer;
          color: var(--accent);
        }
        .contribution-report .legend table {
          border-collapse: collapse;
          margin-top: 8px;
        }
        .contribution-report .legend td {
          padding: 5px 10px 5px 0;
          vertical-align: top;
          color: rgba(255, 255, 255, 0.8);
        }

        /* .stats, .stat, .stat-value and .toggle are also daisyUI component
           classes; the resets below undo daisyUI's versions. */
        .contribution-report .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-auto-flow: row;
          gap: 12px;
          overflow: visible;
          background: none;
          border-radius: 0;
          box-shadow: none;
        }
        .contribution-report .stat {
          display: block;
          padding: 16px;
          text-align: center;
        }
        .contribution-report .stat-value {
          font-family: Archivo, sans-serif;
          font-size: 26px;
          font-weight: 600;
          line-height: 1.3;
          white-space: normal;
          font-variant-numeric: tabular-nums;
        }
        .contribution-report .stat-label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .contribution-report .bar {
          display: flex;
          height: 10px;
          border-radius: 999px;
          overflow: hidden;
          gap: 2px;
          margin-bottom: 14px;
        }
        .contribution-report .bar-seg {
          background: var(--cat);
        }
        .contribution-report .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .contribution-report .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          line-height: 1;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: rgba(255, 255, 255, 0.85);
          white-space: nowrap;
        }
        .contribution-report .chip-count {
          font-weight: 700;
        }
        .contribution-report .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--cat);
          flex: none;
        }
        .contribution-report .cat-participation { --cat: var(--c-participation); }
        .contribution-report .cat-outreach { --cat: var(--c-outreach); }
        .contribution-report .cat-content { --cat: var(--c-content); }
        .contribution-report .cat-events { --cat: var(--c-events); }
        .contribution-report .cat-research { --cat: var(--c-research); }
        .contribution-report .cat-governance { --cat: var(--c-governance); }
        .contribution-report .cat-donation { --cat: var(--c-donation); }
        .contribution-report .cat-other { --cat: var(--c-other); }
        .contribution-report .cat-unreviewed { --cat: var(--c-unreviewed); }
        .contribution-report .flag-eligibility {
          background: var(--amber-bg);
          color: var(--amber-text);
          border-color: var(--amber-border);
        }
        .contribution-report .flag-context {
          background: transparent;
          color: var(--muted);
        }
        .contribution-report .ev-upload {
          background: var(--ev-up-bg);
          color: var(--ev-up-text);
          border-color: transparent;
        }
        .contribution-report .ev-links {
          background: var(--ev-link-bg);
          color: var(--ev-link-text);
          border-color: transparent;
        }
        .contribution-report .ev-none {
          background: transparent;
          color: var(--muted);
          border-style: dashed;
        }
        .contribution-report button.filter-chip {
          cursor: pointer;
          font: inherit;
          font-size: 12.5px;
          transition: background 0.15s;
        }
        .contribution-report button.filter-chip:hover {
          background: var(--surface-hover);
        }
        .contribution-report button.filter-chip[aria-pressed='true'] {
          background: rgba(59, 130, 246, 0.2);
          border-color: #3b82f6;
          color: #fff;
        }
        .contribution-report .breakdown > p {
          margin: 12px 0 0;
          font-size: 14px;
        }

        .contribution-report #contributors,
        .contribution-report #submissions,
        .contribution-report .person-detail,
        .contribution-report .entry {
          scroll-margin-top: 96px;
        }
        .contribution-report .toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 16px;
          margin-bottom: 12px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
        }
        .contribution-report .toolbar label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .contribution-report .toolbar input[type='checkbox'] {
          accent-color: #3b82f6;
          width: 16px;
          height: 16px;
        }
        .contribution-report .toolbar input[type='search'] {
          flex: 1 1 240px;
          min-width: 0;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          color: #fff;
          font: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .contribution-report .toolbar input[type='search']::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .contribution-report .toolbar input[type='search']:focus {
          border-color: #3b82f6;
        }
        .contribution-report #people {
          display: grid;
          gap: 10px;
        }
        .contribution-report .person {
          padding: 16px 18px;
          transition: border-color 0.15s;
        }
        .contribution-report .person:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .contribution-report .person[hidden] {
          display: none;
        }
        .contribution-report .person-head,
        .contribution-report .detail-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 4px 12px;
        }
        .contribution-report .person-head {
          justify-content: space-between;
        }
        .contribution-report .person-name {
          font-family: Archivo, sans-serif;
          font-weight: 600;
          font-size: 17px;
          color: #fff;
          text-decoration: none;
        }
        .contribution-report .person-name:hover {
          color: var(--accent-hover);
        }
        .contribution-report .person-head .muted,
        .contribution-report .detail-head .muted {
          font-size: 13px;
        }
        .contribution-report .summary {
          margin: 6px 0 10px;
          color: rgba(255, 255, 255, 0.8);
        }
        .contribution-report .section-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }
        .contribution-report .section-head h2 {
          margin: 0;
        }
        .contribution-report .buttons {
          display: flex;
          gap: 8px;
        }
        .contribution-report .buttons button {
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 7px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: #fff;
          cursor: pointer;
          transition: background 0.15s;
        }
        .contribution-report .buttons button:hover {
          background: var(--surface-hover);
        }

        .contribution-report .person-detail {
          padding: 18px;
          margin-bottom: 16px;
        }
        .contribution-report .detail-head .back {
          margin-left: auto;
          font-size: 13px;
        }
        .contribution-report .entry {
          border-top: 1px solid var(--border);
          padding: 12px 0 4px;
        }
        .contribution-report .entry > summary {
          list-style: none;
          cursor: pointer;
        }
        .contribution-report .entry > summary::-webkit-details-marker {
          display: none;
        }
        .contribution-report .entry-top {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 10px;
          font-size: 13px;
        }
        .contribution-report .entry-top::before {
          content: '▸';
          color: var(--muted);
          transition: transform 0.15s;
        }
        .contribution-report .entry[open] .entry-top::before {
          transform: rotate(90deg);
        }
        .contribution-report .entry .toggle,
        .contribution-report .entry .toggle:hover,
        .contribution-report .entry .toggle:focus-visible {
          all: unset;
          margin-left: auto;
          cursor: pointer;
          color: var(--accent);
          font-size: 13px;
          white-space: nowrap;
        }
        .contribution-report .toggle::after {
          content: 'Show original';
        }
        .contribution-report .entry[open] .toggle::after {
          content: 'Hide original';
        }
        .contribution-report .entry > summary:hover .toggle {
          color: var(--accent-hover);
          text-decoration: underline;
        }
        .contribution-report .entry-id {
          font-family: 'Roboto Mono', ui-monospace, monospace;
          font-weight: 700;
          color: #fff;
        }
        .contribution-report .entry-headline {
          font-weight: 600;
          margin: 6px 0 4px 18px;
        }
        .contribution-report .entry-body {
          margin-left: 18px;
          padding-bottom: 8px;
        }
        .contribution-report .also {
          font-size: 13px;
          color: var(--muted);
        }
        .contribution-report .note {
          font-size: 14px;
          background: var(--amber-bg);
          color: var(--amber-text);
          border-radius: 8px;
          padding: 6px 10px;
          margin: 6px 0;
        }
        .contribution-report .original-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-top: 10px;
        }
        .contribution-report .original {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          background: rgba(0, 0, 0, 0.25);
          border-left: 3px solid rgba(96, 165, 250, 0.5);
          border-radius: 6px;
          padding: 10px 12px;
          margin-top: 4px;
          color: rgba(255, 255, 255, 0.85);
        }
        .contribution-report .meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px 16px;
          margin: 10px 0 0;
          font-size: 13.5px;
        }
        .contribution-report .meta dt {
          font-size: 12px;
          color: var(--muted);
        }
        .contribution-report .meta dd {
          margin: 0;
          overflow-wrap: anywhere;
        }
        .contribution-report .report-footnote {
          margin-top: 32px;
          font-size: 13px;
          color: var(--muted);
          text-align: center;
        }
        .contribution-report :focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        @media (max-width: 640px) {
          .contribution-report .stats {
            grid-template-columns: repeat(2, 1fr);
          }
          .contribution-report .pool-amount {
            font-size: 24px;
          }
          .contribution-report .entry-headline,
          .contribution-report .entry-body {
            margin-left: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .contribution-report .entry-top::before {
            transition: none;
          }
        }
        @media print {
          .contribution-report .toolbar,
          .contribution-report .buttons,
          .contribution-report .back,
          .contribution-report button.filter-chip {
            display: none !important;
          }
          .contribution-report .person,
          .contribution-report .person-detail,
          .contribution-report .entry {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
