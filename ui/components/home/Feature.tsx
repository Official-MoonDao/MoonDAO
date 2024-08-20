import Image from "next/image"
import Link from "next/link"

export default function Feature() {
    return (
        <div 
            className="relative"
            >
            <div id="image-section" 
                className="relative rounded-bl-[5vmax] w-full p-5 pt-0 pb-10 md:p-10 md:pt-0 lg:pr-[20%]"
                >
                <div id="" 
                    className="w-full h-[100px] rounded-bl-[5vmax] bg-dark-cool absolute top-0 left-0 "
                ></div>
                <div id="image-container" 
                    className="gradient-2 rounded-[5vmax] rounded-tr-[20px] pl-[1vmax] relative max-w-[1200px] z-50"
                    >
                    <Link href="/sweepstakes">
                        <Image id="Meet our astronauts"
                            width="2014"
                            height="1336" 
                            alt="Meet our astronauts, Coby Cotton and Dr.Eiman Jahangir"  
                            className="mb-[-25vh] rounded-[5vmax] rounded-tr-[20px]" src="/assets/Astronauts.png" 
                        />
                    </Link>
                </div>
            </div>
            <div id="divider" 
                className="w-full show-xl gradient-11 mt-[50px] h-[500px] ml-[200px] w-[70vw] absolute top-0 right-0 "
            ></div>
        </div>
    )
}
