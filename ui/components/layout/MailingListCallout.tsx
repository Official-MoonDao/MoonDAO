import MailingList from '../layout/MailingList'; 
import { ExpandedFooter } from './ExpandedFooter';


function MailingListCallout() {
    return (
        <section>  
            <div id="container" className="relative flex md:min-h-[500px] lg:min-h-[0px]">
                <div id="background">  
                    <div id="background-gradient" className="gradient-1 w-full h-full absolute bottom-0 left-0 overflow-hidden"></div>
                    <div id="bottom-right-divider" className="divider-7 bg-bottom absolute bottom-[-2px] right-[-20%] md:right-0 w-[60%] md:w-[60%] lg:w-[40%] h-full"></div>
                </div>
                <div id="content-section" className="flex flex-col max-w-[1200px] w-full">
                    <div id="content-container" className="z-10 flex flex-col lg:flex-row">   
                        <div id="top-left-divider" className="divider-6 w-full h-[200px] lg:h-[auto] mt-[-1px]"></div>
                        <div id="content" className="p-5 pb-10 pt-0 lg:pt-5 md:pb-20 flex flex-col lg:ml-[-20%] m-full max-w-[600px]">
                            <h1 className="header font-GoodTimes leading-none flex flex-col">
                                <span style={{fontSize: 'calc(max(7vmin, 30px))'}} className="mt-[5vmax]">Join Our </span>
                                <span style={{fontSize: 'calc(max(10vmin, 30px))'}} className="mt-[1vmin]">MISSION </span>
                            </h1>
                            <p id="paragraph" className="w-full pt-2 pb-5 mr-5">We aim to accelerate the development of a lunar base through better coordination. Want to help? Learn how to contribute to our mission, even if you're new to Web3, and get weekly updates.</p>
                            <MailingList />
                        </div>
                    </div> 
                </div>
            </div>
            <div id="bottom-bar" className="gradient-8">
                <div id="footer-container" className="flex pt-5 flex-col max-w-[1200px]">
                    <p className="p-5">
                        <span className="opacity-[60%">
                            Disclaimer: There is no expectation of profit with the $MOONEY token. It is a governance token. You are not receiving fractionalized ownership of the DAO's assets in exchange for the token, check &nbsp;
                        </span>
                        <span>
                            <u>
                                <a className="opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/About/FAQ">the FAQ</a>
                            </u> 
                        </span>    
                        <span className="opacity-[60%]">
                            &nbsp;for more information and disclaimers.
                        </span>
                    </p>
                    <div className="min-h-[150px] md:min-h-[0px]">
                        <ExpandedFooter 
                          callToActionImage="/assets/MoonDAO-Logo-White.svg"
                          callToActionTitle="Join the Network"
                          callToActionButtonText="Learn More"
                          callToActionButtonLink="/join"
                          hasCallToAction={true}
                          darkBackground={true}
                          isFullwidth={false}
                        />
                    </div>
                </div>
            </div>    
        </section>   
      
    );
  }
  
  export default MailingListCallout;
  