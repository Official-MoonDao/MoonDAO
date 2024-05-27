import React, { ReactNode } from 'react';

interface ContentProps {
    titleSection?: ReactNode;
    header: string;
    subHeader?: string;
    description?: string;
    headerSize?: string; 
    children?: ReactNode;
}

const Content: React.FC<ContentProps> = ({ titleSection, header, subHeader, description, headerSize, children }) => {
    return (
        <div className="relative">
            <div className="z-0 p-0 pt-0 pb-0">
                <div id="title-section-container" className="mb-[80px] lg:mb-[100px]">
                    <div className="relative h-auto z-0">
                        <div id="z-0 gradient-bg" className="gradient-10 w-full h-full rounded-bl-[5vmax] absolute top-0 left-0 "></div>        
                        <section className="flex flex-col lg:flex-row lg:items-center h-full relative max-w-[1200px]">  
                            <div id="image-container" className="w-full h-full relative left-[-1px]">
                                <div id="image" className="feature-4 min-h-[200px] mb-10 md:min-h-[200px] lg:min-h-[450px] md:min-w-[350px]"> </div>
                            </div>
                            <div id="title-wrapper" className="h-auto mt-[-50px] z-50">
                                <div id="title-container" className="p-5 rounded-bl-[5vmax] rounded-tl-[2vmax] lg:ml-[-8vw] w-full h-full md:min-w-[500px]">
                                    <h1 id="header-element" className=" leading-[1] pb-5 font-GoodTimes" style={{ fontSize: headerSize || 'max(25px, 4vw)' }}>
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
                <div id="main-section-container" className="mt-[-100px] lg:mt-[-200px] relative w-full max-w-[1200px]">
                    <div className="m-5 md:m-10">
                        <section className="bg-dark-cool text-white w-full mb-0 mt-0 p-10 pb-20 rounded-[5vmax] rounded-tl-[20px] overflow-hidden min-h-[200px] lg:min-h-[400px]">
                            {children}
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Content;
