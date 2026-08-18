import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import type { DocsSearchEntry } from '@/lib/docs/types'

function scoreEntry(query: string, entry: DocsSearchEntry): number {
  const q = query.toLowerCase()
  if (!q) return 0
  const title = entry.title.toLowerCase()
  if (title === q) return 1
  if (title.startsWith(q)) return 0.9
  if (title.includes(q)) return 0.75
  if (entry.headings.some((h) => h.toLowerCase().includes(q))) return 0.55
  if (entry.description.toLowerCase().includes(q)) return 0.4
  if (entry.body.toLowerCase().includes(q)) return 0.3
  return 0
}

export default function DocsSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<DocsSearchEntry[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/docs-search-index.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setIndex(data)
      })
      .catch(() => {
        if (!cancelled) setIndex([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(() => {
    if (!index || !query.trim()) return []
    return index
      .map((entry) => ({ entry, score: scoreEntry(query, entry) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [index, query])

  return (
    <div className="relative mb-4">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search docs…"
        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-light-cool/40"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-gradient-to-b from-dark-cool to-darkest-cool border border-white/10 rounded-lg overflow-hidden shadow-xl">
          {results.map(({ entry }) => (
            <li key={entry.slug}>
              <button
                type="button"
                onClick={() => {
                  router.push(entry.href)
                  setQuery('')
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/5"
              >
                <div className="text-sm text-white truncate">{entry.title}</div>
                <div className="text-[11px] text-white/40 truncate">{entry.slug}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
