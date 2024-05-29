import Callout1 from '../components/home/Callout1'
import Callout2 from '../components/home/Callout2'
import Callout3 from '../components/home/Callout3'
import Feature from '../components/home/Feature'
import FooterSection from '../components/home/FooterSection'
import Hero from '../components/home/Hero'
import PartnerSection from '../components/home/PartnerSection'
import Video from '../components/home/Video'
import WebsiteHead from '../components/layout/Head'

export default function Home() {
  return (
    <div className="animate-fadeIn overflow-x-hidden absolute flex justify-end w-full h-[100vh] overflow-auto no-bar top-0 right-0">
      <WebsiteHead
        title="Welcome to MoonDAO"
        description="Welcome to MoonDAO's Mission Control!"
      />
      <div className="w-full md:w-[calc(100vw-260px)] lg:w-[calc(100vw-290px)]">
        <Hero />
        <Video />
        <Callout1 />
        <Callout2 />
        <Feature />
        <Callout3 />
        <PartnerSection />
        <FooterSection />
      </div>
    </div>
  )
}
