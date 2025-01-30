import React, { useState } from "react";
import IndexCard from '../layout/IndexCard';
import IndexCardGrid from "../layout/IndexCardGrid";

const indexCardData = [
  {
    icon: "/assets/icon-astronaut.svg",
    iconAlt: "Astronaut",
    header: "Sending Members To Space",
    link: "/sweepstakes",
    hovertext: "Meet Our Astronauts",
    paragraph: (
      <>
        Sent the first crowdraised astronaut to space, through a democratically governed onchain vote, and randomly chose a second member of the community via an onchain sweepstakes.
      </>
    )
  },
  {
    icon: "/assets/icon-ethereum.svg",
    iconAlt: "Ethereum",
    header: "Funding Open Space R&D",
    link: "/propose",
    hovertext: "Submit Your Idea",
    paragraph: (
      <>
        Allocated $300,000+ to over 60 projects and space R&D through community governance, like open source time standards for PNT on the Moon (shortlisted by DARPA for a grant).
      </>
    )
  },
  {
    icon: "/assets/icon-plane.svg",
    iconAlt: "Plane",
    header: "Astronaut Training Program",
    link: "/zero-gravity",
    hovertext: "Train With Us",
    paragraph: (
      <>
        Training future space travelers with innovative programs, like chartering an entire zero gravity flight alongside three NASA astronauts, Charlie Duke, Nicole Stott, and Doug Hurley.
      </>
    )
  },
  {
    icon: "/assets/icon-dao.svg",
    iconAlt: "DAO",
    header: "Space Acceleration Network",
    link: "/join",
    hovertext: "Join the Network",
    paragraph: (
      <>
        The Space Acceleration Network is a startup society that connects space visionaries and organizations with the funding, tools, and support needed to turn bold ideas into reality. 
      </>
    )
  },
  {
    icon: "/assets/icon-lander.svg",
    iconAlt: "Lander",
    header: "First Moon Mission Launched",
    link: "https://docs.moondao.com/Governance/Constitution",
    hovertext: "Read the Constitution",
    paragraph: (
      <>
        Established a constitution for self-governance, which was launched to the surface of the Moon in early-2025 as part of a LifeShip capsule containing a private wallet and lunar bounty.
      </>
    )
  },
  {
    icon: "/assets/icon-governance.svg",
    iconAlt: "Governance",
    header: "Transparent Governance",
    link: "/analytics",
    hovertext: "See Our Analytics",
    paragraph: (
      <>
        We believe in being open, including open source, transparency, and decentralization. As a DAO, we utilize blockchain technologies offering full transparency and accountability.
      </>
    )
  }
];

export default function Callout3() {
    const [singleCol, setSingleCol] = useState(false);

    return ( 
        <section id="callout3-container" 
          className="relative items-start max-w-[1200px] justify-end md:items-start lg:items-start md:justify-end lg:justify-center mt-[5vmax]"
          >
          <div id="background-elements" 
            className="overflow-visible"
          ></div>
          <h2 className="header text-center font-GoodTimes pb-5">What MoonDAO Does</h2>  
          <div id="cards-container" 
            className="rounded-[5vmax] rounded-tr-[0px] p-5 md:p-10 overflow-hidden max-w-[1200px]"
            >
            <IndexCardGrid cards={indexCardData} />
          </div>

        </section>
    )
}
