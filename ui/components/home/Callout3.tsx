import Card from './Card';

export default function Callout3() {
    return ( 
        <section id="callout2-container" className="m-5 lg:mr-10 mb-5 md:mb-20 relative items-start justify-end md:items-start lg:items-start md:justify-end lg:justify-center mt-[25vh]">
            <div id="background-elements" className="overflow-visible">  
            </div>
            <div id="history-container" className="rounded-[5vmax] rounded-tr-[0px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden max-w-[1200px]">
                <div className="p-0 pb-5 md:p-2.5 md:pl-0 md:pt-0">
                    <Card
                        icon="/assets/icon-astronaut.svg" 
                        header="Sending Members To Space" 
                        paragraph={
                            <>
                                Sent the first crowdraised astronaut to space, through a democratically governed onchain vote. Randomly chose a second regular, everyday person who will be flying in the near future. 
                                <br></br><a className="underline" href="https://www.youtube.com/watch?v=YXXlSG-du7c">See The Video</a>
                            </>
                        }
                    />   
                </div>
                <div className="p-0 pb-5 md:p-2.5 md:pr-0 md:pt-0 lg:pr-2.5">
                    <Card 
                        icon="/assets/icon-ethereum.svg" 
                        header="Funding Open Space R&D"
                        paragraph={
                            <>
                                Allocated $100,000+ (50+ ETH) to space R&D projects through community governance, like open source time standards for PNT on the Moon (shortlisted by DARPA for a grant).
                                <br></br><a className="underline" href="https://docs.moondao.com/Projects/Project-System?_gl=1*6w9m8t*_ga*MTA3OTYwMTM0My4xNzAxNzQzMjE4*_ga_QPFCD9VH46*MTcxNjkzNDQ0MC44NS4xLjE3MTY5MzUyNjEuMC4wLjA.">Apply Here</a>
                            </>  
                        }                           
                    />
                </div>
                <div className="p-0 pb-5 md:p-2.5 md:pl-0 lg:pl-2.5 lg:pr-0 lg:pt-0">
                    <Card 
                        icon="/assets/icon-plane.svg" 
                        header="Astronaut Training Program" 
                        paragraph={
                            <>
                                Training future space travelers with innovative programs, like chartering an entire zero gravity flight alongside three NASA astronauts, Charlie Duke, Nicole Stott, and Doug Hurley. 
                                <br></br><a className="underline" href="/zero-gravity">Learn More</a>
                            </> 
                        }                            
                    /> 
                </div>
                <div className="p-0 pb-5 md:p-2.5 md:pr-0 lg:pl-0 lg:pr-2.5 lg:pb-0">
                    <Card 
                        icon="/assets/icon-dao.svg" 
                        header="Borderless Space Participation" 
                        paragraph={
                            <>
                                Developed a first-of-its-kind open-source DAO operating system to improve community governance, onboarding, and coordination, making it possible for global participation in space. 
                                <br></br><a className="underline" href="/join">Join Today</a>
                            </>   
                        }                          
                    />                   
                </div>
                <div className="p-0 pb-5 md:p-2.5 md:pl-0 md:pb-0 lg:pl-2.5">                  
                    <Card 
                        icon="/assets/icon-lander.svg" 
                        header="First Moon Mission Planned" 
                        paragraph={
                            <>
                                Established a constitution for self-governance, which will be sent to the surface of the Moon in late-2024 as part of a LifeShip capsule alongside the DNA of MoonDAO members. 
                                <br></br><a className="underline" href="https://docs.moondao.com/Governance/Constitution">Read The Constitution</a>
                            </>
                        }                             
                    />      
                </div>
                <div className="p-0 md:p-2.5 md:pr-0 md:pb-0">
                    <Card 
                        icon="/assets/icon-governance.svg" 
                        header="Transparent Governance" 
                        paragraph={
                            <>
                               We believe in being open, including open source, transparency, and decentralization. As a DAO, we utilize blockchain technologies offering full transparency and accountability. 
                               <br></br><a className="underline" href="/analytics">See Our Analytics</a>
                            </> 
                        }                        
                    />                 
                </div>
            </div>
        </section>
    )
}
