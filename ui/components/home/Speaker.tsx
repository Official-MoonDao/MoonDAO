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
            className="m-2 md:p-0 md:m-5 mb-0 w-[160px] h-[250px] md:w-[170px] lg:w-[250px] 2xl:w-[300px] lg:h-[380px] flex flex-wrap justify-around items-center rounded-[100vw] group"
        >
            {link ? (
                <Link href={link} className="w-full h-full flex flex-col items-center justify-center">
                    <div
                        className="p-2 bg-gradient-to-br from-[#3044A9] to-[#743F72] rounded-full"
                        style={{ background: "linear-gradient(135deg, #3044A9 20%, #743F72 80%)" }}
                    >
                        <Image
                            width="500"
                            height="500"
                            src={logo}
                            alt={alt}
                            className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-110"
                        />
                    </div>
                    <div className="text-center min-h-[80px] mt-4 w-full max-w-[160px] md:max-w-[250px]">
                        <h3 className={`text-xs md:text-sm lg:text-lg font-semibold font-GoodTimes ${isWhiteText ? 'text-white' : 'text-black'} leading-tight whitespace-nowrap`}>
                            {name}
                        </h3>
                        <p className={`text-xs md:text-sm ${isWhiteText ? 'text-white' : 'text-black'} mt-1 leading-tight`}>
                            {subtitle}
                        </p>
                    </div>
                </Link>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <div
                        className="p-2 bg-gradient-to-br from-[#3044A9] to-[#743F72] rounded-full"
                        style={{ background: "linear-gradient(135deg, #3044A9 20%, #743F72 80%)" }}
                    >
                        <Image
                            width="250"
                            height="250"
                            src={logo}
                            alt={alt}
                            className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-105"
                        />
                    </div>
                    <div 
                        className="text-center mt-4 max-w-[160px] md:max-w-[250px]"
                    >
                        <h3 className={`text-xs md:text-sm font-semibold font-GoodTimes ${isWhiteText ? 'text-white' : 'text-black'} leading-tight whitespace-nowrap`}>
                            {name}
                        </h3>
                        <p className={`text-xs md:text-sm ${isWhiteText ? 'text-white' : 'text-black'} mt-1 leading-tight`}>
                            {subtitle}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}