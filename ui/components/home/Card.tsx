interface CardProps {
    icon: string;
    header: string;
    paragraph: string;
}

export default function Card({ icon, header, paragraph }: CardProps) {
    return (
        <div className="w-full h-full flex flex-col rounded-[20px] relative overflow-visible">
            <div className="divider-8 absolute w-[80%] h-full"></div>
            <div className="bg-dark-cool h-full p-5 pb-20 rounded-[20px] overflow-hidden" >
                <div className="relative flex flex-col items-center">
                    <img src={icon} alt="icon" className="w-1/2 ml-[-20%] h-full p-5" />
                    <div>
                        <h2 className="sub-header font-GoodTimes">
                            {header}
                        </h2>
                        <p>
                            {paragraph}
                        </p>
                    </div>    
                </div>
            </div>
        </div>
    );
}