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
    <div className="w-full px-5 md:px-8 lg:px-12 pb-8 md:pb-12 flex justify-center">
      <div className="w-full max-w-[1200px] bg-gradient-to-br from-slate-900/60 to-slate-800/30 border border-white/[0.06] rounded-2xl px-6 py-5">
        <div className="flex items-center gap-4">
          <Link
            className="flex items-center gap-3 group"
            href={`https://juicebox.money/v5/arb:${projectId}`}
            target="_blank"
          >
            <div className="group-hover:scale-[1.05] transition-all duration-200">
              <JuiceboxLogoWhite />
            </div>
            <span className="text-sm text-gray-400 group-hover:text-white transition-colors duration-200">
              View on Juicebox
            </span>
            {isManager && (
              <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                (Edit Project)
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
