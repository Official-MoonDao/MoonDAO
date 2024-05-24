import Card from './Card';

export default function Callout3() {
        return ( 
                <section className="CALLOUT2-CONTAINER  m-5 lg:mr-10 mb-5 md:mb-20 relative items-start justify-end md:items-start lg:items-start md:justify-end lg:justify-center mt-[25vh]">
                        <div className="BACKGROUND-ELEMENTS overflow-visible">  
                        </div>
                        <div className="HISTORY-CONTAINER rounded-[5vmax] rounded-tr-[0px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden max-w-[1200px]">
                                <div className="p-0 pb-5 md:p-2.5 md:pl-0 md:pt-0">
                                        <Card
                                                icon="/assets/icon-astronaut.svg" 
                                                header="Sending Members To Space" 
                                                paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain vote. Randomly chose a second regular, everyday person who will be flying in the near future."
                                        />
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pr-0 md:pt-0 lg:pr-2.5">
                                        <Card 
                                                icon="/assets/icon-ethereum.svg" 
                                                header="Funding Open Space R&D" 
                                                paragraph="Allocated $100,000+ (50+ ETH) to space R&D projects through community governance, like open source time standards for PNT on the Moon (shortlisted by DARPA for a grant)."
                                        />
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pl-0 lg:pl-2.5 lg:pr-0 lg:pt-0">
                                        <Card 
                                                icon="/assets/icon-plane.svg" 
                                                header="Astronaut Training Program" 
                                                paragraph="Training future space travelers with innovative programs, like chartering an entire zero gravity flight alongside three NASA astronauts, Charlie Duke, Nicole Stott, and Doug Hurley."
                                        /> 
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pr-0 lg:pl-0 lg:pr-2.5 lg:pb-0">
                                        <Card 
                                                icon="/assets/icon-dao.svg" 
                                                header="Borderless Space Participation" 
                                                paragraph="Developed a first-of-its-kind open-source DAO operating system to improve community governance, onboarding, and coordination, making it possible for global participation in space."
                                        />                   
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pl-0 md:pb-0 lg:pl-2.5">                  
                                        <Card 
                                                icon="/assets/icon-governance.svg" 
                                                header="First Moon Mission Planned" 
                                                paragraph="Established a constitution for self-governance, which will be sent to the surface of the Moon in late-2024 as part of a LifeShip capsule alongside the DNA of MoonDAO members."
                                        />      
                                </div>
                                <div className="p-0 md:p-2.5 md:pr-0 md:pb-0">
                                        <Card 
                                                icon="/assets/icon-governance.svg" 
                                                header="Transparent Governance System" 
                                                paragraph="We believe in being open, including open source, transparency, and decentralization. As a DAO, we utilize blockchain technologies offering full transparency and accountability."
                                        />                 
                                </div>
                        </div>
                </section>
        )
}
