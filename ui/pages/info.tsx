import React, { useContext, useEffect, useState } from 'react';
import PreFooter from '../components/layout/PreFooter';
import Container from '../components/layout/Container';
import ContentLayout from '../components/layout/ContentLayout';
import WebsiteHead from '../components/layout/Head';
import CardGrid from '../components/layout/CardGrid';
import Image from 'next/image';
import Footer from '../components/layout/Footer';
import Link from 'next/link';
import { NoticeFooter } from '@/components/layout/NoticeFooter';
import { useAddress, useContract } from '@thirdweb-dev/react';
import { Arbitrum, Sepolia } from '@thirdweb-dev/chains';
import { TEAM_ADDRESSES, CITIZEN_ADDRESSES, HATS_ADDRESS } from 'const/config';
import ChainContext from '@/lib/thirdweb/chain-context';
import { useTeamData } from '@/lib/team/useTeamData';


const cardData = [
  {
    icon: "/assets/icon-news.svg",
    iconAlt: "News and Updates",
    header: "News & Updates",
    link: "/news",
    hovertext: "Read More",
    paragraph: (
      <>
        Weekly updates from MoonDAO about projects, proposals, open votes, and other initiatives. Be sure to subscribe to get updates in your inbox.
      </>
    ),
    inline: true
  },
  {
    icon: "/assets/icon-about.svg",
    iconAlt: "About MoonDAO",
    header: "About MoonDAO",
    link: "/about",
    hovertext: "Learn About MoonDAO",
    paragraph: (
      <>
        Learn about how MoonDAO operates, how you can contribute or propose a project, read about our mission and vision, and more.
      </>
    ),
    inline: true
  },
  {
    icon: "/assets/icon-constitution.svg",
    iconAlt: "Constitution",
    header: "Our Constitution",
    link: "https://docs.moondao.com/Governance/Constitution",
    hovertext: "Read the Constitution",
    paragraph: (
      <>
        This foundational document guides our governance processes, including the roles of the Senate, Member House, Executive Branch, and more.
      </>
    ),
    inline: true
  },
  {
    icon: "/assets/icon-events.svg",
    iconAlt: "Events",
    header: "Our Events",
    link: "/events",
    hovertext: "Attend an Event",
    paragraph: (
      <>
        Get started by attending one of our upcoming online events to find out how you can contribute to our plans by helping out on a project.
      </>
    ),
    inline: true
  },
  {
    icon: "/assets/icon-analytics.svg",
    iconAlt: "MoonDAO Analytics",
    header: "Analytics",
    link: "/analytics",
    hovertext: "Learn More",
    paragraph: (
      <>
        Transparent data and analytics related to our treasury, token, transactions, and more.
      </>
    ),
    inline: true
  }
];

const Info: React.FC = () => {
  const title = "Information Center";
  const description = "Learn More About The Internet's Space Program";
  const image = "/assets/moondao-og.jpg";

  const { selectedChain, setSelectedChain } = useContext(ChainContext);
  const address = useAddress();
  const { contract: teamContract } = useContract(TEAM_ADDRESSES[selectedChain?.slug]);
  const { contract: citizenContract } = useContract(CITIZEN_ADDRESSES[selectedChain?.slug]);
  const { contract: hatsContract } = useContract(HATS_ADDRESS);

  const { isManager, subIsValid } = useTeamData(teamContract, hatsContract, address);

  useEffect(() => {
    setSelectedChain(process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia);
  }, []);

  return (
    <>
      <WebsiteHead title={title} description={description} image={image} />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header="Info Center"
            headerSize="max(20px, 3vw)"
            description={
              <>
                Learn more about the Internet's Space Program with the latest news and project updates, dive into the documentation, join an upcoming online event, or explore transparent analytics about our treasury and transactions.
              </>
            }
            preFooter={
              <NoticeFooter
                isManager={isManager}
                isCitizen={!!address && !isManager && subIsValid}
              />
            }
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
          >
            <div className="mt-10 mb-10 flex justify-center">
              <CardGrid 
                cards={cardData} 
                singleCol={false}
              />
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  );
};

export default Info;