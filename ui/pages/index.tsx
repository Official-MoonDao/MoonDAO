import Callout1 from '../components/home/Callout1'
import Callout2 from '../components/home/Callout2'
import Callout3 from '../components/home/Callout3'
import Feature from '../components/home/Feature'
import PageEnder from '../components/layout/PreFooter'
import Hero from '../components/home/Hero'
import PartnerSection from '../components/home/PartnerSection'
import Video from '../components/home/Video'
import WebsiteHead from '../components/layout/Head'
import Container from '../components/layout/Container'

export default function Home() {
  return (
    <Container>
      <WebsiteHead 
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement." />
      <div>
        <Hero />
        <Video />
        <Callout1 />
        <Callout2 />
        <Feature />
        <Callout3 />
        <PartnerSection />
        <PageEnder />
      </div>
    </Container>
  )
}
