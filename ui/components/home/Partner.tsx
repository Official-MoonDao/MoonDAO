import Image from "next/image";

interface PartnerProps {
    logo: string;
    alt: string;
}

export default function Card({ logo, alt }: PartnerProps) {
    return (
      <div id="partner-container" 
        className="p-5 w-1/2 md:w-1/3 lg:w-1/6 flex flex-col justify-center">
          <Image 
            width="200"
            height="200"
            src={logo} 
            alt={alt} 
            className="" 
          />
      </div>
    );
}