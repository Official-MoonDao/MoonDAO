import Image from 'next/image';
import Link from 'next/link';
import Footer from './Footer';

type NoticeFooterProps = {
  isManager?: boolean;
  isCitizen?: boolean;
  managerTitle?: string;
  managerImage?: string;
  managerDescription?: string;
  managerButtonText?: string;
  managerButtonLink?: string;
  citizenTitle?: string;
  citizenImage?: string;
  citizenDescription?: string;
  citizenButtonText?: string;
  citizenButtonLink?: string;
  defaultTitle?: string;
  defaultImage?: string;
  defaultDescription?: string;
  defaultButtonText?: string;
  defaultButtonLink?: string;
};

export function NoticeFooter({
  isManager = false,
  isCitizen = false,
  defaultTitle = 'Join MoonDAO',
  defaultImage = '../assets/moondao-logo-white.svg',
  defaultDescription = 'Be part of the future of space exploration and join the MoonDAO network state!',
  defaultButtonText = 'Join Us',
  defaultButtonLink = '/join',
  managerTitle = 'Need Help?',
  managerImage = '../assets/MoonDAO-Logo-White.svg',
  managerDescription = "Submit a ticket in MoonDAO's support channel on Discord!",
  managerButtonText = 'Submit a ticket',
  managerButtonLink = 'https://discord.com/channels/914720248140279868/1212113005836247050',
  citizenTitle = 'Need Help?',
  citizenImage = '../assets/MoonDAO-Logo-White.svg',
  citizenDescription = "Submit a ticket in MoonDAO's support channel on Discord!",
  citizenButtonText = 'Submit a ticket',
  citizenButtonLink = 'https://discord.com/channels/914720248140279868/1212113005836247050',
}: NoticeFooterProps) {
  let title = defaultTitle;
  let image = defaultImage;
  let description = defaultDescription;
  let buttonText = defaultButtonText;
  let buttonLink = defaultButtonLink;

  if (isManager) {
    title = managerTitle;
    image = managerImage;
    description = managerDescription;
    buttonText = managerButtonText;
    buttonLink = managerButtonLink;
  } else if (isCitizen) {
    title = citizenTitle;
    image = citizenImage;
    description = citizenDescription;
    buttonText = citizenButtonText;
    buttonLink = citizenButtonLink;
  }

  return (
    <div className="p-5">
      <div className="md:pl-10 flex items-center gap-5 lg:ml-[80px] max-w-[970px] gradient-15 md:ml-7 p-5 md:mr-5 pb-10 rounded-[5vmax] rounded-tl-[20px]">
        <div id="Image container" className="hidden opacity-[90%] lg:block">
          <Image src={image} alt="MoonDAO Logo" width={150} height={150} />
        </div>
        <div id="callout-container" className="flex flex-col">
          <div className="flex wrap items-center">
            <div className="flex justify-center">
              <div id="Image container" className="lg:hidden">
                <Image src="../assets/icon-star.svg" alt="MoonDAO Logo" width={40} height={40} />
              </div>
              <h3 className="header opacity-80 font-GoodTimes">
                {title}
              </h3>
            </div>
          </div>
          <p className="opacity-60 pt-2">
            {description}
          </p>
          <Link href={buttonLink} className="inline-block">
            <div id="button-container" className="gradient-2 hover:pl-7 transform transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-5 px-5 py-3 inline-block">
              {buttonText}
            </div>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}