import React from 'react';

interface CardProps {
    icon: string;
    header: string;
    paragraph: string;
}

export default function Card({ icon, header, paragraph }: CardProps) {
    return (
        <div className="w-full md:min-w-[33%] md:max-w-[33%] p-5 flex flex-col" style={{ flex: 1 }}>
            <div className={`border-2 border-white h-full p-5 pb-10`} >
                <div>
                    <img src={icon} alt="icon" className="w-1/2 h-full p-5" />
                    <h2 className="text-2xl font-GoodTimes">
                        {header}
                    </h2>
                    <p>
                        {paragraph}
                    </p>
                </div>
            </div>
        </div>
    );
}