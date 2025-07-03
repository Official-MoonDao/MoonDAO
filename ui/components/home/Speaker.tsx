import Image from "next/image";
import Link from "next/link";

interface SpeakerProps {
    logo: string;
    alt: string;
    link?: string;
    name: string;
    subtitle: string;
    isWhiteText?: boolean; 
}

export default function Card({ logo, alt, link, name, subtitle, isWhiteText = false }: SpeakerProps) {
    return (
        <div id="speaker-container"
            className="m-2 md:p-0 md:m-4 mb-0 w-[140px] h-[200px] md:w-[150px] lg:w-[220px] 2xl:w-[270px] lg:h-[270px] flex flex-wrap justify-around items-center rounded-[100vw] group"
        >
            {link ? (
                <Link href={link} className="w-full h-full flex flex-col items-center justify-center">
                    <div
                        className="p-1 bg-gradient-to-br from-[#3044A9] to-[#743F72] rounded-full"
                        style={{ background: "linear-gradient(135deg, #3044A9 20%, #743F72 80%)" }}
                    >
                        <Image
                            width="400"
                            height="400"
                            src={logo}
                            alt={alt}
                            className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-110"
                        />
                    </div>
                    <div className="text-center min-h-[50px] mt-1 w-full max-w-[140px] md:max-w-[220px]">
                        <h3 className={`text-xs md:text-sm lg:text-base font-semibold font-GoodTimes ${isWhiteText ? 'text-white' : 'text-black'} leading-tight whitespace-nowrap`}>
                            {name}
                        </h3>
                        <p className={`text-xs ${isWhiteText ? 'text-white' : 'text-black'} mt-1 leading-tight`}>
                            {subtitle}
                        </p>
                    </div>
                </Link>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <div
                        className="p-1 bg-gradient-to-br from-[#3044A9] to-[#743F72] rounded-full"
                        style={{ background: "linear-gradient(135deg, #3044A9 20%, #743F72 80%)" }}
                    >
                        <Image
                            width="200"
                            height="200"
                            src={logo}
                            alt={alt}
                            className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-105"
                        />
                    </div>
                    <div 
                        className="text-center mt-2 max-w-[140px] md:max-w-[220px]"
                    >
                        <h3 className={`text-xs md:text-sm font-semibold font-GoodTimes ${isWhiteText ? 'text-white' : 'text-black'} leading-tight whitespace-nowrap`}>
                            {name}
                        </h3>
                        <p className={`text-xs ${isWhiteText ? 'text-white' : 'text-black'} mt-1 leading-tight`}>
                            {subtitle}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}