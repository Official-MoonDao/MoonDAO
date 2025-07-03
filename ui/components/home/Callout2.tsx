import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Speaker from '../home/Speaker'
import StandardButton from '../layout/StandardButton'
import CitizenTier from '../onboarding/CitizenTier'
import TeamTier from '../onboarding/TeamTier'

export default function Callout2() {
  return (
    <section
      style={{
        backgroundImage: 'url("/assets/mission-hero-bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        id="callout2-container"
        className="z-10 md:rounded-tl-[5vmax] relative flex flex-col-reverse lg:flex-row items-center justify-center lg:justify-between pt-5 p-5 pb-[120px] md:pr-10 md:pl-10 min-h-[800px] bg-gradient-to-bl from-transparent via-[#090D21] via-10% to-transparent to-40%"
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
        </div>
        <div
          id="content"
          className="relative w-full lg:w-[50%] text-center lg:text-left lg:pl-[80px]"
        >
          <div className="max-w-[1200px] mx-auto lg:mx-0">
            <div className="md:w-[95%] lg:w-[70%]">
              <h1 className="header font-GoodTimes text-left max-w-[500px] mx-auto lg:mx-0">
                MoonDAO is <br></br>Permissionless
              </h1>
              <p
                id="paragraph"
                className="pt-2 pb-5 text-lg max-w-[500px] text-left mx-auto lg:mx-0"
              >
                This is an open source space platform where everything is proposed,
                governed, and created by members. Co-govern the treasury by locking
                $MOONEY to become a voter.
              </p>
              <div className="flex items-center justify-start gap-2 mb-5 max-w-[500px] mx-auto lg:mx-0">
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
                  <span className="font-mono text-left">
                    0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395
                  </span>
                </button>
              </div>
              <div className="max-w-[500px] mx-auto lg:mx-0 flex justify-start">
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
        </div>
        <div
          id="astronauts-container"
          className="w-full lg:w-[50%] flex flex-row justify-center lg:justify-end items-center gap-5 mt-10 lg:mt-0"
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
