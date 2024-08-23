import { ReactNode } from "react";
import StandardButton from "./StandardButton";
import Image from 'next/image';
import Frame from "./Frame";

interface CardProps {
    icon?: string;
    iconAlt?: string;
    header?: string;
    paragraph?: ReactNode;
    link?: string;
    hovertext?: string;
    inline?: boolean;
    orgimage?: string;
    subheader?: string;
    entitytype?:string;
    orgid?:string;
}

export default function Card({ icon, header, paragraph, link, hovertext, inline, iconAlt, orgimage, subheader, entitytype, orgid }: CardProps) {
    icon = icon ?? "/assets/icon-star.svg";
    iconAlt = iconAlt ?? "Star";
    
    const cardContent = (
        <span id="card-container" 
            className="flex z-40 flex-col h-full relative bg-dark-cool"
            >
            <div id="top-left-corner-rounding" 
                className="bg-darkest-cool rounded-[20px] w-[50%] h-[50%] absolute top-0 left-0"
            ></div>
            <span id="content-container" 
                className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between">
                <span id="content" 
                    className="relative flex flex-col"
                    >
                    {orgimage &&
                    <div id="org-image-container"
                        className="z-50"
                        >
                        <Frame 
                            noPadding 
                            marginBottom="0px" 
                            className="border-[5px] border-[#090D21]"
                            >
                            <Image 
                                id="org-image"
                                src={orgimage ?? {icon}} 
                                alt="" 
                                width='675' 
                                height='675' 
                                className={` w-full h-full`} 
                            />
                        </Frame>
                    </div>
                }    
                    <span id="title-section"
                        className={`
                            flex 
                            ${inline ? 'flex-row items-center space-x-5 justify-start' : 'flex-col justify-center items-center'}
                        `}
                        >
                        <Image 
                            id="featured-icon"
                            src={icon} 
                            alt={iconAlt} 
                            width='250' 
                            height='250' 
                            className={`
                                z-20 
                                ${inline ? 'w-[50px] h-[50px]' : 'w-[100px] h-[100px] pb-5'}
                            `} 
                        />
                        {header &&
                            <h2 id="main-header"
                                className={`
                                    z-20 pt-[20px] sub-header font-GoodTimes flex items-center 
                                    ${inline ? 'text-left' : 'text-center justify-center md:justify-start'}
                                `}
                                >
                                {header}
                            </h2>
                        }    
                    </span>
                    <div id="description-container" 
                        className="relative z-50"
                        >
                        <div id="description" 
                            className="description">
                            <p>
                                {paragraph}    
                            </p>
                        {hovertext &&    
                            <span id="mobile-button-container" 
                                className="md:hidden flex pt-5 pb-5 justify-start w-full"
                                >
                                <StandardButton
                                    textColor="text-white"
                                    borderRadius="rounded-tl-[10px] rounded-[2vmax]"
                                    link="#"
                                    paddingOnHover="pl-5"
                                    className="gradient-2"
                                    styleOnly={true}
                                    >
                                    {hovertext}
                                </StandardButton>
                            </span>
                        }    
                        </div>
                    {hovertext &&
                        <span id="hovertext-container" 
                            className="hovertext absolute left-0 bottom-[-220px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+200px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
                            >
                            <span className="hidden md:block">
                                {hovertext}
                            </span>
                        </span>
                    }
                    </div>
                </span>
            </span>
        </span>
    );

    return (
        <span id="link-frame" 
            className={`
                card-container w-full h-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
                ${link ? 'cursor-pointer' : ''}
            `}
        >
        {link && 
            <span id="Interactive-Element" 
                className="clip absolute h-full w-full z-10"
            ></span>
        }
        {!link && 
            <span id="Static-Element" 
                className="divider-8 absolute w-[80%] h-full z-10"
            ></span>}
        {link ? (
            <a id="card-link"
                href={link} 
                className="w-full h-full block"
                >
                {cardContent}
            </a>
        ) : (
            cardContent
        )}
        </span>
    );
}