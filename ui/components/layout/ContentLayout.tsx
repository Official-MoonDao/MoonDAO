import React, { ReactNode } from 'react';
import PreFooter from './PreFooter';
import Frame from './Frame';


interface ContentProps {
    titleSection?: ReactNode;
    header?: string;
    subHeader?: string;
    description?: any;
    headerSize?: string;
    children?: ReactNode;
    preFooter?: ReactNode;
    mainBgColor?: string;
    mainPadding?: boolean;
    mode?: 'compact' | 'default';
    popOverEffect?: boolean;
    fullWidth?: boolean; 
}

const ContentLayout: React.FC<ContentProps> = ({
    titleSection,
    header,
    subHeader,
    description,
    headerSize,
    children,
    preFooter,
    mainBgColor = 'dark-cool',
    mainPadding,
    mode = 'default',
    popOverEffect = false,
    fullWidth = false 
}) => {
    const isCompact = mode === 'compact';

    return (
        <div>
            <section id="title-section" 
                className="z-0"
                >
                <div id="title-section-container"
                    >
                    <div id="title-section" 
                        className="relative z-0"
                        >
                        <div id="graphic-element" 
                            className="gradient-10 w-full h-full rounded-bl-[5vmax] absolute top-0 left-0 "
                        ></div>
                        <div id="content-container" 
                            className={`flex flex-col 
                            ${isCompact ? '' : 'lg:flex-row lg:items-start'} h-full relative max-w-[1200px]`}
                            >
                            <div id="image-container" 
                                className="w-full h-full relative left-[-1px]"
                                >
                                <div id="image" 
                                    className={`feature-4 mb-10 min-h-[200px] 
                                    ${isCompact ? '' : 'md:min-h-[200px] lg:min-h-[600px] md:min-w-[450px]'}`}
                                ></div>
                            </div>
                            <div id="title-wrapper" 
                                className={`
                                    z-50 w-full overflow-x-hidden mt-[-80px] p-5 pt-0 
                                    ${isCompact ? 'pl-5 md:pl-[56px]' : 'lg:ml-[-10vw] lg:mt-0 md:p-10'} 
                                    ${children ? "pb-0 md:pb-[100px] lg:pb-[200px]" : "flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]"}
                                `}
                                >
                                <div id="title-container" 
                                    className={`
                                        p-5 pl-0 pb-10 md:pb-0 w-full h-full 
                                        ${isCompact ? '' : 'md:max-w-[700px] lg:max-w-[100%]'}
                                    `}
                                    >
                                    <h1 
                                        id="header-element" 
                                        className={`
                                            w-full leading-[1] pb-5 font-GoodTimes 
                                            ${isCompact ? 'pt-5' : 'lg:pt-20'} 
                                        `} 
                                        style={{ fontSize: headerSize || 'max(25px, 4vw)' }}
                                        >
                                        {header}
                                    </h1>
                                    
                                    {subHeader && 
                                    <h2 id="sub-header" 
                                        className="sub-header"
                                        >
                                        {subHeader}
                                    </h2>
                                    }
                                    <div 
                                        className={` 
                                            ${isCompact ? 'pb-0 w-full lg:w-[70%]' : 'pb-5 md:pb-20 lg:pb-15 '} 
                                        `}
                                        >
                                        {description && 
                                        <span>
                                            {description}
                                        </span>
                                    }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {children && (
            <section id="main-section-container"
                >
                <div id="main-section"
                    className={`
                        relative w-full max-w-[1200px] 
                        ${mainPadding ? 'p-0' : 'pb-5'} 
                        ${isCompact ? 'mt-0 md:mt-[-120px] lg:mt-[-200px]' : 'mt-0 md:mt-[-200px] lg:mt-[-280px] md:pb-0 '}
                    `}
                    >
                    <div id="content-container"
                        className={`relative z-10 
                            ${isCompact ? 'md:ml-0' : 'md:m-10'} 
                            ${popOverEffect ? ' pb-0 mb-0 md:mb-[-160px]':''} 
                            ${fullWidth ? 'p-0' : ''}
                        `} 
                        >
                        <Frame 
                            noPadding 
                            marginBottom='0px'
                            >
                            <div id="content" 
                                className={`m-5 
                                    ${isCompact ? 'md:m-10' : 'md:m-0'}
                                `}
                                >
                                {children}
                            </div>
                        </Frame>
                    </div>
                </div>
                {preFooter && (
                <div id="spacer" 
                    className={`bg-white rounded-tl-[5vmax] w-full h-[5vh] md:h-[200px] 
                        ${popOverEffect ? '' : 'hidden'}
                    `} 
                ></div>
                )}
            </section>
            )}

            {preFooter && (
            <section id="preFooter-container"
                >
                <div>
                    {preFooter}
                </div>
            </section>
            )}

            {!preFooter && (
            <section id="default-prefooter-container"
                >
                <div id="prefooter-container" 
                    className="min-h-[120px] md:min-h-[70px]"
                    >
                    <PreFooter/>
                </div>
            </section>
            )}
        </div>
    );
}

export default ContentLayout;