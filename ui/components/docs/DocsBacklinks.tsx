import Link from 'next/link'
import type { DocsBacklink } from '@/lib/docs/types'

export default function DocsBacklinks({ items }: { items: DocsBacklink[] }) {
  if (items.length === 0) return null
  return (
    <section className="mt-12 pt-6 border-t border-white/10">
      <h2 className="font-GoodTimes text-sm uppercase tracking-wider text-white/40 mb-3">
        Linked from
      </h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.slug}>
            <Link
              href={item.href}
              className="text-sm px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
