export type Testimonial = {
  name: string
  quote: string
  affiliation: string
}

// Testimonial with its matched citizen photo attached (see getStaticProps in
// pages/join.tsx) — image is null (not undefined) when no citizen match was
// found, since getStaticProps props must be JSON-serializable.
export type TestimonialWithPhoto = Testimonial & { image?: string | null }

// Explicit testimonial-name -> citizen-id overrides, for cases where the
// on-chain display name doesn't resemble the name used in the testimonial
// (e.g. Giovanna's citizen profile is named "Astro.gio"). Checked before the
// fuzzy name match in getStaticProps.
export const TESTIMONIAL_CITIZEN_IDS: Record<string, number> = {
  Giovanna: 24,
}

// Matched at build time (see getStaticProps in pages/join.tsx) against
// on-chain citizen records by name, to pull each person's real citizen
// profile photo. If a name doesn't match, the card falls back to an
// initials avatar — check the build log for a warning when that happens.
export const testimonials: Testimonial[] = [
  {
    name: 'Rachel Williams',
    affiliation: 'Open Lunar',
    quote:
      "We've used MoonDAO's job board for every Open Lunar role we've posted, and the quality of applicants has been consistently outstanding. The submissions are high-signal and thoughtful, coming from people who are genuinely mission-aligned and already engaged in the space ecosystem — not just mass applicants clicking through generic postings. In a hiring landscape increasingly flooded with low-quality, AI-generated applications, MoonDAO has been a refreshing exception.",
  },
  {
    name: "Andrew 'Titan' Parris",
    affiliation: 'MoonDAO Citizen',
    quote:
      "We needed to reach a dedicated, space-positive audience to support our growth. MoonDAO's Space Acceleration Network provided exactly that. By setting up our Team page, we were able to directly engage with a community aligned with our mission to make space more accessible to all. Within weeks of listing our Spaceflight Training classes, we secured our first direct sale.",
  },
  {
    name: 'Eiman',
    affiliation: 'Citizen Astronaut, Blue Origin',
    quote:
      "None of the things I've achieved over the past few years would have come true without being selected as MoonDAO's second Citizen astronaut and embarking on my flight with Blue Origin. I dreamed of becoming an astronaut for many decades and finally found my path to space through MoonDAO. I'm so grateful to be part of this community and to be able to continue playing an active role in shaping our future in space.",
  },
  {
    name: 'Anastasia',
    affiliation: 'MoonDAO Citizen',
    quote:
      'MoonDAO is a great way to secure funding for the early stages of a project. This support becomes a powerful catalyst, helping your project gain momentum while bypassing much of the traditional bureaucracy associated with conventional funding. The process is fast, efficient, and accessible. Beyond the financial support, the genuine encouragement from the community and the opportunity to build new connections were incredibly meaningful.',
  },
  {
    name: 'Giovanna',
    affiliation: 'MoonDAO Citizen',
    quote:
      "Thanks to MoonDAO, I've had opportunities that once felt out of reach. I took part in a Zero-G flight alongside astronauts, witnessed my first SpaceX launch at Starbase, and experienced a Blue Origin launch. Beyond these incredible moments, MoonDAO creates something even more valuable: community. Here, I realized my dreams are not strange... they are shared. I love being part of MoonDAO!",
  },
  {
    name: 'Lakshmi',
    affiliation: 'LunARC',
    quote:
      "MoonDAO funded our riskiest idea and gave LunARC the momentum to keep going. Funding for radical space imagination is hard to find, especially in the philanthropic sector when your work sits outside traditional categories. MoonDAO's support for our Bolivia workshop gave LunARC the second wind we needed — not just to prove the idea could work, but to build real momentum. That momentum carried us straight into our next lab in Cairo, with more on the horizon.",
  },
]

export type WhyJoinPillar = {
  icon: string
  iconAlt: string
  header: string
  paragraph: string
}

export const whyJoinPillars: WhyJoinPillar[] = [
  {
    icon: '/assets/icon-ethereum.svg',
    iconAlt: 'Funding',
    header: 'Fund Your Project, Fast',
    paragraph:
      'Skip the grant-cycle bureaucracy. Pitch the community directly and get funded in weeks, not years — even for the ambitious, hard-to-categorize ideas traditional funders pass on.',
  },
  {
    icon: '/assets/icon-org.svg',
    iconAlt: 'Jobs',
    header: 'Real Jobs, Real Teams',
    paragraph:
      'Access a jobs board full of high-signal roles from teams already building in space — no mass-applicant noise, just people genuinely aligned with the mission.',
  },
  {
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Astronaut',
    header: 'Flights & Experiences',
    paragraph:
      "From Zero-G flights to Blue Origin launches, MoonDAO has sent everyday citizens to space and keeps opening doors to experiences that once felt impossible.",
  },
  {
    icon: '/assets/icon-governance.svg',
    iconAlt: 'Governance',
    header: 'Governance & Ownership',
    paragraph:
      'Every proposal, vote, and treasury movement is onchain. As a citizen, you help decide where the mission goes next — not just watch from the sidelines.',
  },
  {
    icon: '/assets/icon-dao.svg',
    iconAlt: 'Community',
    header: 'A Global Community',
    paragraph:
      'Meet friends and collaborators across the space industry, from founders to astronauts — a place where working on space is celebrated, not strange.',
  },
]
