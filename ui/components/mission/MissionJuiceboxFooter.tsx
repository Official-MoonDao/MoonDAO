import Link from 'next/link'
import JuiceboxLogoWhite from '../assets/JuiceboxLogoWhite'

type MissionJuiceboxFooterProps = {
  projectId: number
  isManager: boolean
}

export default function MissionJuiceboxFooter({
  projectId,
  isManager,
}: MissionJuiceboxFooterProps) {
  return (
    <div className="w-full px-5 md:px-8 lg:px-12 mt-4 md:mt-6 pb-8 md:pb-12 flex justify-center">
      <div className="w-full max-w-[1200px] bg-gradient-to-br from-slate-800/60 to-slate-700/40 border border-white/[0.08] rounded-2xl px-6 md:px-8 py-6 md:py-8">
        <Link
          className="flex items-center gap-4 group"
          href={`https://juicebox.money/v5/arb:${projectId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="group-hover:scale-[1.05] transition-all duration-200 flex-shrink-0">
            <JuiceboxLogoWhite />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-medium text-white group-hover:text-gray-200 transition-colors duration-200">
              View on Juicebox
              {isManager && (
                <span className="ml-2 text-sm font-normal text-gray-400 group-hover:text-gray-300 transition-colors">
                  (Edit Project)
                </span>
              )}
            </span>
            <span className="text-sm text-gray-400">
              View and manage this mission&apos;s funding on Juicebox
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
