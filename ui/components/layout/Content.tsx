import React, { ReactNode } from 'react';
import Footer from './Footer'; 

interface ContentProps {
    titleSection?: ReactNode;
    header?: string;
    subHeader?: string;
    description?: ReactNode;
    headerSize?: string; 
    children?: ReactNode;
    callout?: ReactNode;
}

const Content: React.FC<ContentProps> = ({ titleSection, header, subHeader, description, headerSize, children, callout }) => {
    return (
        <div>            
            <section className="z-0">
                <div id="title-section-container" className="pl-5 md:pl-0">
                    <div className="relative z-0">
                        <div id="z-0 gradient-bg" className="gradient-10 w-full h-full rounded-bl-[5vmax] absolute top-0 left-0 "></div>        
                        <div className="flex flex-col lg:flex-row h-full relative max-w-[1200px] lg:items-start">  
                            <div id=" image-container" className="w-full h-full relative left-[-1px]">
                                <div id="image" className="feature-4 mb-10 min-h-[200px] md:min-h-[200px] lg:min-h-[600px] md:min-w-[450px]"> </div>
                            </div>
                            <div id="title-wrapper" className={`z-50 w-full overfow-x-hidden lg:ml-[-10vw] mt-[-80px] lg:mt-0 p-5 md:p-10 pt-0 ${children ? "pb-0 md:pb-[100px] lg:pb-[200px]" : "flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]"}`}>
                                <div id="title-container" className="p-5 pl-0 w-full h-full md:max-w-[700px] lg:max-w-[100%]">
                                    <h1 id="header-element" className="w-full leading-[1] pb-5 lg:pt-20 font-GoodTimes" style={{ fontSize: headerSize || 'max(25px, 4vw)' }}>
                                        {header}
                                    </h1>
                                    {subHeader && <h2 id="sub-header" className=" sub-header">{subHeader}</h2>}
                                    <div className="pb-5 md:pb-20 lg:pb-15">
                                        {description && <span>{description}</span>}   
                                    </div>
                                </div>
                            </div>
                        </div>   
                    </div> 
                </div>
            </section>

            {children && (
            <section>
                <div id="main-section-container" className="pb-5 md:pb-0 relative ml-[-20px] md:ml-0 mt-0 md:mt-[-200px] lg:mt-[-280px] relative w-full max-w-[1200px]">
                    <div className={`m-5 mr-0 md:m-10 relative z-10 ${callout ? "pb-0 mb-0 md:mb-[-160px]" : "pb-10"}`}>
                        <div id="main-section" className="bg-dark-cool text-white w-full mb-0 mt-0 p-5 pl-10 md:p-10 pb-10 rounded-tl-0 rounded-bl-0 rounded-br-[5vmax] rounded-tr-[5vmax] md:rounded-tl-[20px] md:rounded-bl-[5vmax] overflow-hidden min-h-[200px] lg:min-h-[400px]">
                            {children}
                        </div>
                    </div>
                </div>
                {callout && ( <div id="spacer" className="bg-white rounded-tl-[5vmax] w-full h-[5vh] md:h-[200px]"></div> )} 
            </section>    
            )}

            {callout && (
            <section className="">
                <div>
                    {callout}
                </div>
            </section>
            )}  
            
            {!callout && (
            <section>
                <div id="footer-container" className="min-h-[120px] md:min-h-[70px]">
                    <Footer />
                </div>
            </section>
            )}

        </div>
    );
}

export default Content;
