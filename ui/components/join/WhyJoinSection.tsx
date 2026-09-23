import Image from 'next/image'
import Reveal from '@/components/home/landing/Reveal'
import SectionHeading from '@/components/home/landing/SectionHeading'
import { whyJoinPillars } from 'const/joinPageContent'

export default function WhyJoinSection() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(66,94,235,0.14),transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <SectionHeading
          eyebrow="Why Join"
          title={
            <>
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                Get Involved
              </span>
            </>
          }
          description="MoonDAO is more than a membership — it's funding, a network, and a direct path to the space industry."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
          {whyJoinPillars.map((pillar, i) => (
            <Reveal key={pillar.header} delay={0.08 * (i % 3)} className="h-full">
              <div className="flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md transition-all duration-300 hover:border-white/30 hover:bg-white/[0.06] md:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#425EEB]/30 to-[#6C407D]/30 ring-1 ring-white/15">
                  <Image
                    src={pillar.icon}
                    alt={pillar.iconAlt}
                    width={30}
                    height={30}
                    className="h-7 w-7"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <h3 className="font-GoodTimes text-lg text-white md:text-xl">
                    {pillar.header}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/65 md:text-base">
                    {pillar.paragraph}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
