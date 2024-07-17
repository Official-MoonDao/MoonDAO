import React, { useState } from "react";
import Card from '../layout/Card';
import CardGrid from "../layout/CardGrid";

const cardData = [
  {
    icon: "/assets/icon-astronaut.svg",
    iconAlt: "Astronaut",
    header: "Sending Members To Space",
    link: "https://www.youtube.com/watch?v=YXXlSG-du7c",
    hovertext: "Watch the Video",
    paragraph: (
      <>
        Sent the first crowdraised astronaut to space, through a democratically governed onchain vote. Randomly chose a second regular, everyday person who will be flying in the near future.
      </>
    )
  },
  {
    icon: "/assets/icon-ethereum.svg",
    iconAlt: "Ethereum",
    header: "Funding Open Space R&D",
    link: "https://docs.moondao.com/Projects/Project-System?_gl=1*6w9m8t*_ga*MTA3OTYwMTM0My4xNzAxNzQzMjE4*_ga_QPFCD9VH46*MTcxNjkzNDQ0MC44NS4xLjE3MTY5MzUyNjEuMC4wLjA.",
    hovertext: "Learn More",
    paragraph: (
      <>
        Allocated $100,000+ (50+ ETH) to space R&D projects through community governance, like open source time standards for PNT on the Moon (shortlisted by DARPA for a grant).
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
    header: "Borderless Space Participation",
    link: "/join",
    hovertext: "Join Today",
    paragraph: (
      <>
        Developed a first-of-its-kind open-source DAO operating system to improve community governance, onboarding, and coordination, making it possible for global participation.
      </>
    )
  },
  {
    icon: "/assets/icon-lander.svg",
    iconAlt: "Lander",
    header: "First Moon Mission Planned",
    link: "https://docs.moondao.com/Governance/Constitution",
    hovertext: "Read the Constitution",
    paragraph: (
      <>
        Established a constitution for self-governance, which will be sent to the surface of the Moon in late-2024 as part of a LifeShip capsule alongside the DNA of MoonDAO members.
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
        <section id="callout2-container" 
          className="relative items-start justify-end md:items-start lg:items-start md:justify-end lg:justify-center mt-[25vh]"
          >
          <div id="background-elements" 
            className="overflow-visible"
          ></div>
          <div id="cards-container" 
            className="rounded-[5vmax] pb-10 rounded-tr-[0px] p-5 md:p-10 overflow-hidden max-w-[1200px]"
            >
            <CardGrid cards={cardData} />
          </div>
        </section>
    )
}
