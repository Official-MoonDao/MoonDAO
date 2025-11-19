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
    <div className="w-full px-[5vw] pb-[5vw] md:pb-[2vw] flex justify-center">
      <div className="w-full bg-gradient-to-r from-darkest-cool to-dark-cool max-w-[1200px] rounded-[5vw] md:rounded-[2vw] px-0 py-4">
        <div className="flex items-center relative rounded-tl-[20px] rounded-bl-[5vmax] p-4">
          <div
            className="pl-4 pr-8 flex overflow-x-auto overflow-y-hidden"
            style={{
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Link
              className="flex flex-col group"
              href={`https://juicebox.money/v5/arb:${projectId}`}
              target="_blank"
            >
              <div className="group-hover:scale-[1.05] transition-all duration-200">
                <JuiceboxLogoWhite />
              </div>
              {isManager && (
                <p className="text-xs opacity-90 uppercase group-hover:scale-105 transition-all duration-200">
                  (Edit Project)
                </p>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
