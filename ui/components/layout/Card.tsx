import { ReactNode } from "react";
import StandardButton from "./StandardButton";
import Image from 'next/image';

interface CardProps {
    icon: string;
    iconAlt: string;
    header: string;
    paragraph: ReactNode;
    link?: string;
    hovertext?: string;
    inline?: boolean;
}

export default function Card({ icon, header, paragraph, link, hovertext, inline, iconAlt }: CardProps) {
    const cardContent = (
        <span className="flex flex-col h-full relative bg-dark-cool">
            <div className="bg-darkest-cool rounded-[20px] w-[100px] h-[100px] absolute top-0 left-0"></div>
            {hovertext &&
                <span className="absolute hovertext w-full pb-[30px] md:pb-10 pt-5 text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex items-center justify-center bottom-0 h-[30px] z-50">
                    <span className="hidden md:block">
                        {hovertext}
                    </span>
                    <span className="md:hidden flex pl-5 pb-5 justify-start w-full">
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
                </span>
            }
            <span className="h-full p-5 md:p-10 pb-10 md:pb-20 rounded-[20px] overflow-hidden flex flex-col justify-between">
                <span id="content-container" className={`relative flex flex-col ${inline ? 'space-y-5' : 'space-y-5'}`}>
                    <span className={`flex ${inline ? 'flex-row items-center space-x-5 justify-start' : 'flex-col justify-center items-center'}`}>
                        <Image src={icon} alt={iconAlt} width='250' height='250' className={`z-20 ${inline ? 'w-[50px] h-[50px]' : 'w-[100px] h-[100px] pb-5'}`} />
                        <h2 className={`z-20 pt-[20px] sub-header font-GoodTimes flex items-center ${inline ? 'text-left' : 'text-center justify-center md:justify-start'}`}>
                            {header}
                        </h2>
                    </span>
                    <p className={`z-50 w-full ${hovertext ? 'pb-[35px] md:pb-5' : 'pb-5'}`}>
                        {paragraph}
                    </p>
                </span>
            </span>
        </span>
    );

    return (
        <span className={`card-container w-full h-full flex lg:flex-col rounded-[20px] relative overflow-hidden ${link ? 'cursor-pointer' : ''}`}>
            {link && 
            <>
                <span id="Interactive-Element" className="clip absolute h-full w-full z-10"></span>
            </>    
            }
            {!link && <span id="Static-Element" className="divider-8 absolute w-[80%] h-full z-10"></span>}
            {link ? (
                <a href={link} className="w-full h-full block">
                    {cardContent}
                </a>
            ) : (
                cardContent
            )}
        </span>
    );
}