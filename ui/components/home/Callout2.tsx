import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Speaker from '../home/Speaker'
import StandardButton from '../layout/StandardButton'
import CitizenTier from '../onboarding/CitizenTier'
import TeamTier from '../onboarding/TeamTier'

export default function Callout2() {
  return (
    <section>
      <div
        id="callout2-container"
        className="z-10 md:rounded-tl-[5vmax] relative flex flex-col items-end lg:items-start justify-end pt-0 lg:pt-5 p-5 pb-[5vmax] md:pr-10 md:pl-10 min-h-[250px] lg:min-h-[600px] bg-gradient-to-bl from-transparent via-[#090D21] via-10% to-transparent to-40%"
      >
        <div id="background-elements">
          <div
            id="background-gradient"
            className="w-full h-[50%] absolute bottom-0 left-0"
          ></div>
          <div
            id="bottom-divider"
            className="hidden divider-4 absolute left-0 bottom-[-2px] w-[60%] h-full"
          >
            <Image
              src="/assets/divider-4.svg"
              alt="Divider 4"
              width={1000}
              height={1000}
            />
          </div>
          <div
            id="featured-image-large"
            className="hide-xl absolute top-0 right-0 w-[80vmin] md:w-[70%] lg:w-[45vmax] mt-[-5vmax] h-full mt-5"
          >
            <Image
              className="absolute top-0 right-0"
              src="/assets/feature-3.svg"
              alt="Feature 3"
              width={400}
              height={400}
            />
          </div>
          <div
            id="featured-image-extra-large"
            className="show-xl absolute top-0 right-0 w-[900px] h-[50vw]"
          >
            <Image
              className="absolute top-0 right-0"
              src="/assets/feature-3.svg"
              alt="Feature 3"
              width={650}
              height={650}
            />
          </div>
        </div>
        <div
          id="content"
          className="relative pt-[220px] lg:pt-20 md:pb-0 w-full lg:w-[70%] mx-auto text-center"
        >
          <h1 className="header font-GoodTimes text-left max-w-[500px] mx-auto">
            MoonDAO is <br></br>Permissionless
          </h1>
          <p
            id="paragraph"
            className="pt-2 pb-5 text-lg max-w-[500px] text-left mx-auto"
          >
            This is an open source space platform where everything is proposed,
            governed, and created by members. Co-govern the treasury by locking
            $MOONEY to become a voter.
          </p>
          <div className="flex items-center justify-start gap-2 mb-5 max-w-[500px] mx-auto">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  '0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395'
                )
                toast.success('Address copied to clipboard.')
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/assets/icon-copy.svg"
                alt="Copy address"
                width={20}
                height={20}
              />
              <span className="font-mono break-all text-left">
                0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395
              </span>
            </button>
          </div>
          <div className="max-w-[500px] mx-auto flex justify-start">
            <StandardButton
              backgroundColor="bg-white"
              textColor="text-dark-cool"
              borderRadius="rounded-tl-[10px] rounded-[2vmax]"
              link="/get-mooney"
              paddingOnHover="pl-5"
            >
              Buy $MOONEY
            </StandardButton>
          </div>
        </div>
      </div>
      <div
        id="our-astronauts-section"
        className="sm:px-2 md:p-5 z-50 flex flex-col items-start overflow-hidden"
      >
        <div
          id="astronauts-container"
          className="p-1 flex flex-wrap w-full justify-center gap-5 scale-[90%] md:scale-[100%] lg:scale-[115%] my-[20px] z-50"
        >
          <Speaker
            alt="Coby Cotton"
            logo="/assets/astronaut-coby.png"
            name="Coby Cotton"
            subtitle="MoonDAO's 1st Astronaut"
            link="https://www.youtube.com/watch?v=YXXlSG-du7c"
            isWhiteText={true}
          />
          <Speaker
            alt="Dr. Eiman Jahangir"
            logo="/assets/astronaut-eiman.png"
            name="Dr. Eiman Jahangir"
            subtitle="MoonDAO's 2nd Astronaut"
            link="https://www.youtube.com/watch?v=O8Z5HVXOwsk"
            isWhiteText={true}
          />
        </div>
      </div>
    </section>
  )
}
