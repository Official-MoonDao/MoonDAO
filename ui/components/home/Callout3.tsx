import React, { useState } from 'react'
import IndexCardGrid from '../layout/IndexCardGrid'

const indexCardData = [
  {
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Astronaut',
    header: 'Human Spaceflight',
    link: '/sweepstakes',
    hovertext: 'Meet the Astronauts',
    paragraph: (
      <>
        Sent the first crowdraised astronaut to space, selected via onchain voting, and a second everyday person randomly via onchain sweepstakes.
      </>
    ),
  },
  {
    icon: '/assets/icon-ethereum.svg',
    iconAlt: 'Ethereum',
    header: 'Fund Space R&D',
    link: '/propose',
    hovertext: 'Submit An Idea',
    paragraph: (
      <>
        Allocated $600,000+ to over 75 projects via community
        governance.
      </>
    ),
  },
  {
    icon: '/assets/icon-plane.svg',
    iconAlt: 'Plane',
    header: 'Space Training',
    link: '/zero-gravity',
    hovertext: 'Train for Space',
    paragraph: (
      <>
        Training future space travelers with zero gravity flights and other innovative missions.
      </>
    ),
  },
  {
    icon: '/assets/icon-dao.svg',
    iconAlt: 'DAO',
    header: 'Bringing Industry Onchain',
    link: '/join',
    hovertext: 'Join the Network',
    paragraph: (
      <>
        The Space Acceleration Network connects individuals and organizations with the funding, tools, and support
        to turn bold ideas into reality.
      </>
    ),
  },
  {
    icon: '/assets/icon-lander.svg',
    iconAlt: 'Lander',
    header: 'Moon Mission Landing',
    link: '/constitution',
    hovertext: 'Read the Constitution',
    paragraph: (
      <>
        Established a constitution for self-governance, which landed on
        the surface of the Moon in early-2025.
      </>
    ),
  },
  {
    icon: '/assets/icon-governance.svg',
    iconAlt: 'Governance',
    header: 'Transparent Governance',
    link: '/analytics',
    hovertext: 'See Our Analytics',
    paragraph: (
      <>
        As a DAO, we utilize blockchain technologies offering
        full transparency and accountability.
      </>
    ),
  },
]

export default function Callout3() {
  return (
    <section
      id="callout3-container"
      className="relative items-center justify-center max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px] mx-auto mt-[5vmax] px-4 2xl:px-8 3xl:px-12"
    >
      <div id="background-elements" className="overflow-visible"></div>
      <h2 className="header text-center font-GoodTimes pb-5 2xl:pb-8 3xl:pb-12 text-4xl 2xl:text-6xl 3xl:text-7xl">
        At A Glance
      </h2>
      <div
        id="cards-container"
        className="rounded-[5vmax] rounded-tr-[0px] p-5 md:p-10 2xl:p-16 3xl:p-20 overflow-hidden max-w-[1200px] 2xl:max-w-[1400px] 3xl:max-w-[1600px]"
      >
        <IndexCardGrid cards={indexCardData} threeCol={true} />
      </div>
    </section>
  )
}
