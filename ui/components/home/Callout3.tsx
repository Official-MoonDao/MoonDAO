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
                                                header="Sending Two Members To Space" 
                                                paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election"
                                        />
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pr-0 md:pt-0 lg:pr-2.5">
                                        <Card 
                                                icon="/assets/icon-ethereum.svg" 
                                                header="Funding Open Space R&D" 
                                                paragraph="Allocated $100,000+ (50+ ETH) to space R&D projects through our community governance, like open source time standards for PNT on the Moon (shortlisted by DARPA for a grant) "
                                        />
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pl-0 lg:pl-2.5 lg:pr-0 lg:pt-0">
                                        <Card 
                                                icon="/assets/icon-plane.svg" 
                                                header="Astronaut Training Program" 
                                                paragraph="Sent the first crowdraised astronaut to space, through a democratically governed onchain election."
                                        /> 
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pr-0 lg:pl-0 lg:pr-2.5 lg:pb-0">
                                        <Card 
                                                icon="/assets/icon-dao.svg" 
                                                header="Borderless Access To Space" 
                                                paragraph="Developed a first-of-its-kind open-source DAO operating system to improve community governance, onboarding, and coordination"
                                        />                   
                                </div>
                                <div className="p-0 pb-5 md:p-2.5 md:pl-0 md:pb-0 lg:pl-2.5">                  
                                        <Card 
                                                icon="/assets/icon-governance.svg" 
                                                header="First Moon Mission Planned" 
                                                paragraph="Established a constitution for self-governance, which will be sent to the surface of the Moon in 2024 with LifeShip. See the video"
                                        />      
                                </div>
                                <div className="p-0 md:p-2.5 md:pr-0 md:pb-0">
                                        <Card 
                                                icon="/assets/icon-ticket.svg" 
                                                header="Hosted Sweepstakes" 
                                                paragraph="Launched the Ticket To Space Sweepstakes to select an everyday person to go to space"
                                        />                 
                                </div>
                        </div>
                </section>
        )
}
