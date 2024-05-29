interface PartnerProps {
    logo: string;
    alt: string;
}

export default function Card({ logo, alt }: PartnerProps) {
    return (
      <div className="p-5 w-1/2 md:w-1/3 lg:w-1/6 flex flex-col justify-center">
          <img src={logo} alt={alt} className="" />
      </div>
    );
}