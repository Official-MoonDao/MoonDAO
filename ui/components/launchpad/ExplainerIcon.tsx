import Image from 'next/image'

type FeatureIconProps = {
  title: string
  description: string
  icon: string | React.ReactNode
  gradient?: string
  numberBackground?: string
  subtext?: string
}

export default function FeatureIcon({
  title,
  description,
  icon,
  gradient,
  numberBackground,
  subtext,
}: FeatureIconProps) {
  return (
    <div
      className={`mb-[5vw] flex flex-col w-full md:w-[27.5vw] h-auto items-center`}
      >
      <div className={`${gradient || numberBackground} rounded-full m-[2vw]`}>
        {typeof icon === 'string' ? (
          <div className="flex items-start mix-blend-screen justify-center w-fit h-fit rounded-full p-[5vw] aspect-square">
            <Image
              className=""
              src={icon}
              alt={title}
              width={300}
              height={300}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-[40vw] h-[40vw] md:w-[25vw] md:h-[25vw] lg:w-[15vw] lg:h-[15vw] m-[2vw] rounded-full">
            <div className="text-[max(1.5vw,18px)] md:text-[1vw] font-GoodTimes text-white uppercase">
              T-Minus
            </div>
            <div className="text-[15vw] md:text-[5vw] font-GoodTimes text-white mt-[-3vw] md:mt-[-1vw]">
              {icon} 
            </div>
            {subtext && (
              <div className="text-white text-[2.5vw] md:text-[max(1vw,16px)] font-GoodTimes">
                {subtext.split('<br/>').map((part, index) => (
                  <div key={index}>{part}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="">
        <h2 className="mt-[5vw] md:mt-[2vw] text-[5vw] md:text-[max(2vw,25px)] font-GoodTimes">
          {title}
        </h2>
        <p className="md:text-[max(1.2vw,16px)] 2xl:text-[18px]">{description}</p>
      </div>  
    </div>
  )
}
