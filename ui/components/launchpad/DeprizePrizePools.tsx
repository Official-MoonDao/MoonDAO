import Link from 'next/link'
import type { DeprizeLaunchCard } from '@/lib/launchpad/deprizeLaunchCards'

export default function DeprizePrizePools({ cards }: { cards: DeprizeLaunchCard[] }) {
  if (!cards.length) return null
  return (
    <section className="px-4 py-16 sm:px-6 md:px-8 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-2xl font-semibold text-white sm:text-3xl">Prize pools</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
          Back a MoonDAO prize. Every contribution lands in that prize pool.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                <p className="font-heading text-xl font-semibold text-white">{card.title}</p>
                <p className="mt-3 text-sm text-violet-200">Open the prize</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
