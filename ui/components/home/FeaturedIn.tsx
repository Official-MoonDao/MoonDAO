import Image from "next/image";
import Link from "next/link";

interface FeaturedInProps {
    logo: string;
    alt: string;
    link?: string;
}

export default function Card({ logo, alt, link }: FeaturedInProps) {
    return (
        <div id="featured-in-container" 
            className="p-5 w-[150px] md:w-1/6 flex flex-col justify-center">
            {link ? (
                <Link href={link}>  
                    <Image 
                        width="300"
                        height="100"
                        src={logo} 
                        alt={alt} 
                        className="" 
                    />
                </Link>
            ) : (
                <Image 
                    width="300"
                    height="100"
                    src={logo} 
                    alt={alt} 
                    className="" 
                />
            )}
        </div>
    );
}