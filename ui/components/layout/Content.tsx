import React, { ReactNode } from 'react';

interface ContentProps {
    titleSection?: ReactNode;
    header?: string;
    subHeader?: string;
    description?: string;
    headerSize?: string; 
    children?: ReactNode;
}

const Content: React.FC<ContentProps> = ({ titleSection, header, subHeader, description, headerSize, children }) => {
    return (
        <div className="">
            
            <div className="z-0 p-0 pt-0 pb-0"> 
                <div id="title-section-container" className="overflow-x-hidden">
                    <div className="relative z-0">
                        <div id="z-0 gradient-bg" className="gradient-10 w-full h-full rounded-bl-[5vmax] absolute top-0 left-0 "></div>        
                        <section className={`flex flex-col lg:flex-row h-full relative max-w-[1200px] ${children ? "lg:items-center" : "lg:items-start " } `}>  
                            <div id="image-container" className="w-full h-full relative left-[-1px]">
                                <div id="image" className="feature-4 min-h-[200px] mb-10 md:min-h-[200px] lg:min-h-[550px] md:min-w-[500px]"> </div>
                            </div>
                            <div id="title-wrapper" className={`z-50 overfow-x-hidden mt-[-80px] lg:mt-0 min-w-[500px] pr-10 ${children ? "pb-10 md:pb-[100px] lg:pb-[200px]" : "flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]"}`}>
                                <div id="title-container" className="p-5 pr-10 lg:ml-[-8vw] max-w-[100vw] w-full h-full md:max-w-[700px] lg:max-w-[100%]">
                                    <h1 id="header-element" className="w-full leading-[1] pb-5 font-GoodTimes" style={{ fontSize: headerSize || 'max(25px, 4vw)' }}>
                                        {header}
                                    </h1>
                                    {subHeader && <h2 id="sub-header" className=" sub-header">{subHeader}</h2>}
                                    <div className="">
                                        {description && <p>{description}</p>}   
                                    </div>
                                </div>
                            </div>
                        </section>   
                    </div> 
                </div>
            </div>

            {children && (
                <div id="main-section-container" className="ml-[-20px] md:ml-0 mt-0 md:mt-[-100px] lg:mt-[-200px] relative w-full max-w-[1200px]">
                    <div className="m-5 md:m-10">
                        <section id="main-section" className="bg-dark-cool text-white w-full mb-0 mt-0 p-5 md:p-10 pb-20 rounded-[5vmax] rounded-tl-[20px] overflow-hidden min-h-[200px] lg:min-h-[400px]">
                            {children}
                        </section>
                    </div>
                </div>
            )}

        </div>
    );
}

export default Content;
