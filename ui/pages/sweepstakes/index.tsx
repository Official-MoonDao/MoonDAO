import Head from '../../components/layout/Head'
import Container from '@/components/layout/Container'
import SweepstakesHighlights from '@/components/ticket-to-space/SweepstakesHighlights'

export default function Sweepstakes() {
  return (
    <Container>
      <main className="animate-fadeIn">
        <Head
          title="Ticket to Space"
          image="https://gray-main-toad-36.mypinata.cloud/ipfs/QmdTYGGb5ayHor23WeCsNeT61Qzj8JK9EQmxKWeuGTQhYq"
        />
        <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 bg-gradient-to-br from-gray-900/40 via-blue-900/20 to-purple-900/10 backdrop-blur-xl rounded-2xl shadow-2xl lg:mt-10 lg:w-full lg:max-w-[1080px] z-50">
          <h1 className="text-white font-bold font-GoodTimes text-2xl">
            Meet Our Astronauts | Ticket to Space
          </h1>
          <SweepstakesHighlights />
        </div>
      </main>
    </Container>
  )
}
