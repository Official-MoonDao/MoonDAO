import { ReactNode, useEffect, useState } from "react";
import StandardButton from "../layout/StandardButton";
import Image from 'next/image';
import Frame from "../layout/Frame";
import Link from 'next/link';
import { ThirdwebNftMedia } from '@thirdweb-dev/react'
import { MeshStandardMaterial } from "three";

interface CardProps {
    icon?: string;
    iconAlt?: string;
    header?: string;
    paragraph?: ReactNode;
    link?: string;
    hovertext?: string;
    inline?: boolean;
    orgimage?: string;
    subheader?: any;
    entitytype?: string;
    orgid?: string;
    metadata?: any;
    owner?: string;
    type?: string;
    horizontalscroll?: boolean;
    role?:string
}

export default function Card({ 
    icon,
    header,
    paragraph,
    link,
    hovertext,
    inline,
    iconAlt,
    orgimage,
    subheader,
    entitytype,
    orgid,
    metadata,
    owner,
    type,
    role,
    horizontalscroll=false,
}: CardProps) {
    icon = type === "entity" ? "/assets/icon-org.svg" : (icon ?? "/assets/icon-passport.svg");
    iconAlt = iconAlt ?? "Star";

    const [citizenDiscord, setCitizenDiscord] = useState<string | undefined>();

    useEffect(() => {
        if (type === 'citizen' && metadata) {
            const discordAttribute = metadata.attributes?.find((attr: any) => attr.trait_type === 'discord');
            setCitizenDiscord(discordAttribute?.value);
        }
    }, [type, metadata]);

    const cardContent = (       
        <span id="card-container" 
            className={`
                animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[200px]
            `}
            >
            <div id="card-styling" 
                className={`
                    bg-darkest-cool rounded-[20px] min-w-[450px] h-[30%] absolute top-0 left-0 pb-5
                `}
            ></div>
            <span id="content-container" 
                className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between border-b-[3px] border-r-[3px] border-darkest-cool"
                >
                <span id="content" 
                    className="animate-fadeIn relative z-50 flex flex-col"
                    >
                    {orgimage && (
                    <div id="featured-image-container" className="z-50 animate-fadeIn"
                        >
                        <Frame 
                            noPadding 
                            marginBottom="0px" 
                            >
                            <Image 
                                id="featured-image"
                                src={orgimage} 
                                alt="Entity Image" 
                                width='675' 
                                height='675' 
                                className="w-full h-full" 
                            />
                        </Frame>
                    </div>
                    )}
                    {ThirdwebNftMedia && metadata && (
                    <div id="entity-citizen-image-container" 
                        className="z-40"
                        >
                        <Frame 
                            noPadding 
                            marginBottom="0px" 
                            className=""
                            >
                            <ThirdwebNftMedia
                                className=""
                                metadata={metadata}
                                height={'100%'}
                                width={'100%'}
                            />
                        </Frame>
                    </div>    
                    )}
                    <span id="title-section" 
                        className={`
                            flex 
                            ${inline ? 'pb-5 flex-row items-center pr-5 justify-start' : 'flex-col justify-center items-center'}
                        `}
                        >
                        <Image 
                            id="featured-icon"
                            src={icon} 
                            alt={iconAlt} 
                            width='250' 
                            height='250' 
                            className={`z-20 ${inline ? 'pt-[20px] w-[50px] h-[50px]' : 'w-[100px] h-[100px] pb-5'}`} 
                        />
                        
                            <h2 id="main-header" 
                                className={`z-20 pt-[20px] static-sub-header font-GoodTimes flex items-center 
                                ${inline ? 'text-left' : 'text-center justify-center md:justify-start'}`}
                                >
                                {header && (
                                header
                                )}
                                {metadata?.name ? metadata.name : "Anon"}
                            </h2>
                        
                    </span>
                    {subheader && (
                                subheader
                                )}
                    <div id="description-and-id-container" 
                        className="relative z-50"
                        >
                        <div id="description-and-id" 
                            className="description"
                            >
                            <div className="flex opacity-[70%]">
                                {paragraph}
                                 {metadata?.id && (
                                    "ID: "+ metadata.id +" |"
                                )}
                                {owner && (
                                <p id="owner-wallet"
                                    className="pl-2"
                                    >
                                    {owner.slice(0, 6)}...{owner.slice(-4)}
                                </p>
                                )}
                            </div>
                            {metadata?.id ? (
                            <div id="details-container"
                                className="mt-4"
                                >
                                <p id="org-description">
                                    {metadata.description && metadata.description.length > 100
                                    ? `${metadata.description.slice(0, 100)}...`
                                    : metadata.description}
                                </p>
                                {type === 'citizen' && citizenDiscord && (
                                    <div id="handle-container"
                                        >
                                        Discord: @{citizenDiscord}
                                    </div>
                                )}
                            </div>
                            ):(
                            <div id="details-container"
                                className="mt-4"
                                >
                                <p id="org-description">
                                    This citizen has yet to add a profile 
                                </p>
                                <div id="handle-container"
                                    >
                                    Discord: NONE
                                </div>
                            
                            </div>                            
                            )
                        
                            }
                            {hovertext && (
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
                            )}
                        </div>
                        {hovertext && (
                        <span id="hovertext-container" 
                            className="hovertext absolute left-0 bottom-[-320px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+300px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
                            >
                            <span 
                                className="hidden md:block"
                                >
                                {hovertext}
                            </span>
                        </span>
                        )}
                    </div>
                </span>
            </span>
        </span>
    );

    return (
        <span id="link-frame" 
            className={`
                card-container min-w-[300px] w-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
                ${link ? 'cursor-pointer' : ''}
            `}
            >
            {(link || metadata) &&
            <span id="Interactive-Element" 
                className="clip absolute h-full w-full z-10"
            ></span>}
            {(!link || !metadata) &&
            <span id="Static-Element" 
                className="divider-8 absolute w-[80%] h-full z-10"
            ></span>}
            {link ? (
            <Link id="card-link" 
                href={link} 
                className="w-full h-full block"
            >
                {cardContent}
            </Link>
            ) : (
            metadata ? (
            <Link
                href={
                    metadata.name
                    ? `/${type === 'entity' ? 'entity' : 'citizen'}/${metadata.id}`
                    : ''
                }
                passHref
                > 
                {cardContent}
            </Link>
            ) : (
            cardContent
            )
            )}
        </span>
    );
}
 