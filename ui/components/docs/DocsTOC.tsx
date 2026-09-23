import type { DocsTocItem } from '@/lib/docs/types'

export default function DocsTOC({ items }: { items: DocsTocItem[] }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="On this page" className="text-sm">
      <h2 className="font-GoodTimes text-xs uppercase tracking-wider text-white/40 mb-3">
        On this page
      </h2>
      <ul className="space-y-1.5 border-l border-white/10">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.depth - 1) * 0.75 + 0.75}rem` }}>
            <a
              href={`#${item.id}`}
              className="text-white/50 hover:text-white transition-colors block py-0.5"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
