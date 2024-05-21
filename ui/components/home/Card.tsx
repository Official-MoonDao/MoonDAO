import React from 'react';

interface CardProps {
    icon: string;
    header: string;
    paragraph: string;
}

export default function Card({ icon, header, paragraph }: CardProps) {
    return (
        <div className="w-full h-full flex flex-col rounded-[20px] overflow-hidden">
            <div className={`bg-dark-cool h-full p-10 pb-20`} >
                <div>
                    <img src={icon} alt="icon" className="w-1/2 h-full p-5" />
                    <h2 className="sub-header font-GoodTimes">
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