import Image from "next/image";
import Link from "next/link";

interface LogoProps {
    logo: string;
    alt: string;
    link?: string;
}

export default function BrandLogo({ logo, alt, link }: LogoProps) {
    return (
        <div 
            id="logo-container" 
            className="w-[30%] md:w-1/4 lg:w-1/5 flex flex-col justify-center mx-1 md:mx-5 my-1 md:my-2"
        >
            {link ? (
                <Link 
                    href={link} 
                    className="opacity-[50%] hover:opacity-[100%] grayscale hover:grayscale-0 transition-all duration-300"
                    >
                    <Image 
                        width="300" 
                        height="100" 
                        src={logo} 
                        alt={alt} 
                    />
                </Link>
            ) : (
                <Image 
                    width="300" 
                    height="100" 
                    src={logo} 
                    alt={alt} 
                    className="transition-none"  // No animation if no link
                />
            )}
        </div>
    );
}