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
            className="m-2 md:p-0 md:m-4 mb-0 w-[160px] h-[220px] md:w-[150px] lg:w-[240px] 2xl:w-[290px] 3xl:w-[340px] lg:h-[270px] 2xl:h-[320px] 3xl:h-[380px] flex flex-col justify-start items-center rounded-[100vw] group"
        >
            {link ? (
                <Link href={link} className="w-full h-full flex flex-col items-center justify-start pt-4">
                    <div
                        className="p-1 bg-gradient-to-br from-[#3044A9] to-[#743F72] rounded-full"
                        style={{ background: "linear-gradient(135deg, #3044A9 20%, #743F72 80%)" }}
                    >
                        <Image
                            width="300"
                            height="300"
                            src={logo}
                            alt={alt}
                            className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-110 w-[100px] h-[100px] md:w-[120px] md:h-[120px] lg:w-[160px] lg:h-[160px] xl:w-[200px] xl:h-[200px] object-cover"
                        />
                    </div>
                    <div className="text-center min-h-[50px] mt-3 lg:mt-4 xl:mt-6 2xl:mt-8 3xl:mt-10 w-full max-w-[160px] md:max-w-[240px] 2xl:max-w-[290px] 3xl:max-w-[340px]">
                        <h3 className={`text-xs md:text-base lg:text-lg xl:text-xl 2xl:text-2xl 3xl:text-3xl font-semibold font-GoodTimes ${isWhiteText ? 'text-white' : 'text-black'} leading-tight text-center whitespace-nowrap`}>
                            {name}
                        </h3>
                        <p className={`text-sm md:text-base lg:text-lg 2xl:text-xl 3xl:text-2xl ${isWhiteText ? 'text-white' : 'text-black'} mt-2 lg:mt-3 2xl:mt-4 3xl:mt-5 leading-tight text-center`}>
                            {subtitle}
                        </p>
                    </div>
                </Link>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-start pt-4">
                    <div
                        className="p-1 bg-gradient-to-br from-[#3044A9] to-[#743F72] rounded-full"
                        style={{ background: "linear-gradient(135deg, #3044A9 20%, #743F72 80%)" }}
                    >
                        <Image
                            width="300"
                            height="300"
                            src={logo}
                            alt={alt}
                            className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-105 w-[100px] h-[100px] md:w-[120px] md:h-[120px] lg:w-[160px] lg:h-[160px] xl:w-[200px] xl:h-[200px] object-cover"
                        />
                    </div>
                    <div 
                        className="text-center mt-3 lg:mt-4 xl:mt-6 2xl:mt-8 3xl:mt-10 max-w-[160px] md:max-w-[240px] 2xl:max-w-[290px] 3xl:max-w-[340px]"
                    >
                        <h3 className={`text-xs md:text-base lg:text-lg xl:text-xl 2xl:text-2xl 3xl:text-3xl font-semibold font-GoodTimes ${isWhiteText ? 'text-white' : 'text-black'} leading-tight text-center whitespace-nowrap`}>
                            {name}
                        </h3>
                        <p className={`text-sm md:text-base lg:text-lg 2xl:text-xl 3xl:text-2xl ${isWhiteText ? 'text-white' : 'text-black'} mt-2 lg:mt-3 2xl:mt-4 3xl:mt-5 leading-tight text-center`}>
                            {subtitle}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}