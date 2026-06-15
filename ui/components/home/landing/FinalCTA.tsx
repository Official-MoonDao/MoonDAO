import Image from 'next/image'
import MailingList from '../../layout/MailingList'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import Starfield from './Starfield'

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#010208] pb-32 pt-28 md:pb-48 md:pt-44">
      <div className="absolute inset-0">
        <Image
          src="/assets/landing/earthrise.jpg"
          alt=""
          fill
          className="object-cover opacity-50"
          style={{ objectPosition: 'center 35%' }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208] via-[#010208]/55 to-dark-cool" />
      </div>
      <Starfield className="opacity-60" />

      <div className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col items-center px-5 text-center md:px-10">
        <Reveal>
          <span className="font-RobotoMono text-xs uppercase tracking-[0.35em] text-[#7c8cff]">
            The Mission Needs You
          </span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-5 font-GoodTimes text-3xl leading-[1.15] text-white md:text-5xl 2xl:text-6xl">
            Take Humanity Back{' '}
            <span className="bg-gradient-to-r from-[#7c8cff] via-[#b07ce8] to-[#22d3ee] bg-clip-text text-transparent">
              to the Moon
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            We&apos;re accelerating the development of a lunar base through
            better coordination. Whether you&apos;re new to Web3 or a space
            industry veteran, there&apos;s a place for you in the network.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <CtaButton href="/join" variant="primary">
              Join the Network
            </CtaButton>
            <CtaButton href="/about" variant="secondary">
              Learn More
            </CtaButton>
          </div>
        </Reveal>
        <Reveal delay={0.4}>
          <div className="mt-12 flex flex-col items-center gap-3">
            <p className="font-RobotoMono text-[11px] uppercase tracking-[0.25em] text-white/45">
              Or get weekly mission updates
            </p>
            <MailingList />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
