import Head from '../../components/layout/Head'
import SweepstakesHighlights from '@/components/ticket-to-space/SweepstakesHighlights'

export default function Sweepstakes() {
  return (
    <main className="animate-fadeIn">
      <Head
        title="Ticket to Space"
        image="https://gray-main-toad-36.mypinata.cloud/ipfs/QmdTYGGb5ayHor23WeCsNeT61Qzj8JK9EQmxKWeuGTQhYq"
      />
      <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
        <h1 className={`page-title flex text-lg`}>Ticket to Space</h1>
        <SweepstakesHighlights />
      </div>
    </main>
  )
}
