import Image from "next/image";
import Link from "next/link";

interface PartnerProps {
    logo: string;
    alt: string;
    link?: string; 
}

export default function Card({ logo, alt, link }: PartnerProps) {
    return (
      <div id="partner-container" 
        className="p-5 w-[250px] md:w-1/3 flex flex-col justify-center">
          {link ? (
              <Link href={link}>
                      <Image 
                          width="400"
                          height="200"
                          src={logo} 
                          alt={alt} 
                          className="" 
                      />
              </Link>
          ) : (
              <Image 
                  width="400"
                  height="200"
                  src={logo} 
                  alt={alt} 
                  className="" 
              />
          )}
      </div>
    );
}