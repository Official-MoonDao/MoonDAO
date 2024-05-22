interface CardProps {
    icon: string;
    header: string;
    paragraph: string;
}

export default function Card({ icon, header, paragraph }: CardProps) {
    return (
        <div className="w-full h-full flex lg:flex-col rounded-[20px] relative">
            <div className="divider-8 absolute w-[80%] h-full"></div>
            <div className="bg-dark-cool h-full p-5 pb-10 md:pb-20 rounded-[20px] overflow-hidden" >
                <div className="relative flex md:flex-col md:items-center max-w-[450px]">
                    <img src={icon} alt="icon" className="w-[20%] pr-5 md:w-1/2 md:ml-[-20%] h-full md:p-5" />
                    <div>
                        <h2 className="sub-header min-h-[80px] font-GoodTimes flex items-center">
                            {header}
                        </h2>
                        <p className="ml-[-20%] md:ml-0">
                            {paragraph}
                        </p>
                    </div>    
                </div>
            </div>
        </div>
    );
}