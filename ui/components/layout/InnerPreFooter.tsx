import React from 'react';
import MailingList from './MailingList';
import { ExpandedFooter } from './ExpandedFooter';

export default function InnerPreFooter() {
    return (
        <section id="prefooter-container">
            <div id="prefooter" 
                className="innerprefooter-popout-bg md:min-h-[500px] lg:min-h-[0px] md:ml-0 lg:ml-5 lg:p-5 md:p-0 relative"
                >
                <div id="background"
                    >
                    <div id="background-gradient" 
                        className="gradient-1 absolute top-0 left-0 w-full h-full md:rounded-bl-[5vmax] md:rounded-tl-[20px] rounded-tr-[5vmax]"
                    ></div>
                </div>
                <div id="content-section" 
                    className="flex flex-col max-w-[1200px]"
                    >
                    <div id="content-container" 
                        className="z-10 flex flex-col lg:flex-row"
                        >
                        <div id="content" 
                            className="p-5 px-5 md:p-5 md:px-10 pb-5 pt-0 lg:pt-5 md:pb-20 flex flex-col m-full max-w-[600px]lg:ml-[-20%]"
                            >
                            <h1 id="content-header"
                                className="header font-GoodTimes leading-none flex flex-col"
                                >
                                <span style={{ fontSize: 'calc(max(4vmin, 30px))' }} className="mt-[5vmax]">
                                    MoonDAO's 
                                </span>
                                <span style={{ fontSize: 'calc(max(6vmin, 30px))' }}>
                                    MISSION 
                                </span>
                            </h1>
                            <p id="paragraph" 
                                className="w-full pt-2 pb-5 pr-0 md:pr-5 mr-5"
                                >
                                MoonDAO aims to accelerate the development of a lunar base through better coordination. Want to help? Learn how to contribute to our mission, even if you're new to Web3, and get weekly updates.
                            </p>
                            <MailingList />
                        </div>
                    </div>
                </div>
            </div>
            <div id="bottom-bar" 
                className="gradient-8"
                >
                <div id="footer-container" 
                    className="flex pt-5 flex-col max-w-[1200px]"
                    >
                    <div id="footer" 
                        className="min-h-[150px] md:min-h-[0px]"
                        >
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