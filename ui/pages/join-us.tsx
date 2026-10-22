import { GetStaticProps } from 'next'
import Link from 'next/link'
import React from 'react'
import {
  FALLBACK_SUBSCRIBER_LABEL,
  SUBSCRIBER_COUNT_REVALIDATE_SECONDS,
} from '@/lib/convert-kit/subscriberLabel'
import { LogoSidebar } from '../components/assets'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import MailingList from '../components/layout/MailingList'

type JoinUsProps = {
  subscriberLabel: string
}

const BULLETS = [
  "Mission news, like who we're sending to space next",
  'Invites to town halls, livestreams, and events',
  'First look at grants, projects, and ways to get involved',
]

const JoinUs: React.FC<JoinUsProps> = ({ subscriberLabel }) => {
  const label = subscriberLabel || FALLBACK_SUBSCRIBER_LABEL

  return (
    <>
      <WebsiteHead
        title="MoonDAO Newsletter | The Internet's Space Program"
        description="Space news, event invites, and ways to help build a decentralized space program."
      />
      <section className="w-full">
        <Container>
          <div className="mx-auto w-full max-w-3xl px-1 pb-16 pt-6 sm:pt-10">
            <div className="w-40 text-white sm:w-48">
              <LogoSidebar />
            </div>

            <header className="mt-8 max-w-xl" data-hero>
              <p className="font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-moon-gold">
                Free newsletter
              </p>
              <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Follow the Internet's Space Program
              </h1>
              <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
                Short updates on our missions, events, and how you can help.
              </p>
              <div className="mt-6">
                <MailingList submitLabel="Subscribe" compact ctaLocation="join_us" />
              </div>
            </header>

            <ul className="mt-10 grid max-w-xl gap-3">
              {BULLETS.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-sm leading-relaxed text-white/80 sm:text-base"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moon-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <ul className="mt-10 grid gap-3 sm:grid-cols-3">
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="font-heading text-2xl font-semibold text-white">{label}</p>
                <p className="mt-1 text-sm text-white/60">newsletter readers</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <Link
                  href="/citizen"
                  className="font-heading text-2xl font-semibold text-white hover:text-moon-gold"
                >
                  {/* Refresh from the on-chain Citizen totalSupply when the count passes 270. */}
                  260+
                </Link>
                <p className="mt-1 text-sm text-white/60">Citizens in the network</p>
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <a
                  href="https://moondao.com/discord"
                  className="font-heading text-2xl font-semibold text-white hover:text-moon-gold"
                >
                  Discord
                </a>
                <p className="mt-1 text-sm text-white/60">Meet the community</p>
              </li>
            </ul>

            <aside className="mt-12 max-w-xl border-t border-white/10 pt-8">
              <p className="font-RobotoMono text-[11px] uppercase tracking-[0.18em] text-white/40">
                Proof it works
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                In 2022 MoonDAO sent Coby Cotton of Dude Perfect to space, the first person a DAO
                ever sent there. That was the start. Next, we're working to fly more of the
                community.
              </p>
            </aside>
          </div>
        </Container>
      </section>
    </>
  )
}

export const getStaticProps: GetStaticProps<JoinUsProps> = async () => {
  const { fetchActiveSubscriberLabel } = await import('@/lib/convert-kit/subscriberCount')
  const subscriberLabel = await fetchActiveSubscriberLabel()
  return {
    props: { subscriberLabel },
    revalidate: SUBSCRIBER_COUNT_REVALIDATE_SECONDS,
  }
}

export default JoinUs
