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
    contentwide?: boolean; 
    branded?: boolean;
    isProfile?:boolean;
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
    contentwide = false, 
    branded = true,
    isProfile = false, 
}) => {
    const isCompact = mode === 'compact';

    return (
        <div className="">
            <section id="title-section" 
                className="z-0"
                >
                <div id="title-section-container"
                    >
                    <div id="title" 
                        className="relative z-0"
                        >
                        <div id="graphic-element-container"
                            >
                            <div id="graphic-element" 
                                className="gradient-10 w-full h-full rounded-bl-[2vmax] md:rounded-bl-[5vmax] absolute top-0 left-0"
                            ></div>
                        </div>
                        <div id="content-container" 
                            className={`
                                flex flex-col h-full relative max-w-[1200px]
                                ${isCompact ? '' : 'lg:flex-row lg:items-start'} 
                            `}
                            >
                            <div id="image-container" 
                                className="w-full h-full relative left-[-1px]"
                                >
                                <div id="image" 
                                    className={`mb-10
                                    ${branded ? 'branded min-h-[200px]' : 'absolute unbranded min-h-[350px] min-w-[350px]'} 
                                    ${isCompact ? '' : 'md:min-h-[200px] lg:min-h-[600px] md:min-w-[450px]'}`}
                                ></div>
                            </div>
                            <div id="title-wrapper" 
                                className={`
                                    z-50 w-full overflow-x-hidden p-5 pt-0 mt-[-80px]
                                    ${isCompact ? 'pl-5 lg:pl-[56px]' : 'lg:ml-[-10vw] lg:mt-0 md:p-10 md:pb-5'} 
                                    ${children ? 'pb-0 lg:pb-[120px]' : 'flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]'}
                                    ${isProfile ? 'lg:mb-[-100px]':''}
                                `}
                                >
                                <div id="title-container" 
                                    className={`
                                        p-5 pl-0 pb-5 md:pb-0 w-full h-full 
                                        ${isCompact ? '' : 'md:max-w-[700px] lg:max-w-[100%]'}
                                    `}
                                    >
                                    <h1 
                                        id="header-element" 
                                        className={`
                                            w-full leading-[1] font-GoodTimes 
                                            ${isCompact ? 'pt-0' : 'lg:pt-20'} 
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
                                            pt-2 pb-2 
                                            ${isCompact ? 'pb-0 w-full' : 'pb-5 md:pb-20 lg:pb-15 '} 
                                            ${branded ? '' : 'mt-20'}
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
                className="popout-base-bg" 
                >
                <div id="main-section"
                    className={`
                        relative w-full max-w-[1200px] mt-0 
                        ${mainPadding ? 'p-0' : 'pb-5'} 
                        ${isCompact && !isProfile ? 'mt-0 md:mt-[-120px] lg:mt-[-200px]' : isCompact && isProfile ? '' : 'mt-0 md:mt-[-200px] lg:mt-[-280px] md:pb-0 '}
                    `}
                    >
                                                {popOverEffect ? 
                        null:
                        <div id="popout-bg-element" 
                            className={`
                                z-0 popout-bg absolute w-full md:w-[calc(100%-40px)] lg:w-[calc(100%-100px)] left-0 md:left-[50px] lg:left-[100px] rounded-bl-[20px] 
                                ${!isProfile ? `h-[calc(100%-200px)] top-[200px]`:'h-full top-0'}
                                `}
                        ></div> 
                        }
                    <div id="main-section-content-container"
                        className={`relative z-10 
                            ${isCompact && !popOverEffect ? 'md:ml-0' : 'md:m-10'} 
                            ${isCompact && popOverEffect ? 'md:ml-0' : 'md:m-0'} 
                            ${popOverEffect ? ' pb-0 mb-0 md:mb-[-160px]':''} 
                            ${contentwide ? 'p-0' : ''}
                        `} 
                        >

                        <div className="rounded-[5vw] rounded-tl-[20px] overflow-hidden">
                            <div id="content" 
                                className={` z-50
                                    ${isCompact && !isProfile ? 'md:m-10' : (isCompact ? 'md:m-0 md:mt-5 md:mr-5' : 'm-5')}
                                `}
                                >
                                    <div className="z-50">
                                        {children}
                                    </div>
                            
                            </div>
                        </div>

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
            <section id="preFooter-container-element"
                >
                {preFooter}
            </section>
            )}

        </div>
    );
}

export default ContentLayout;