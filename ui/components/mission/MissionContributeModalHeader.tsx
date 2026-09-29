import { XMarkIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'

interface MissionContributeModalHeaderProps {
  missionName?: string
  onClose: () => void
  compact?: boolean
}

export function MissionContributeModalHeader({
  missionName,
  onClose,
  compact = false,
}: MissionContributeModalHeaderProps) {
  return (
    <div className={`flex items-center justify-between border-b border-white/10 ${compact ? 'pb-4 mb-5' : 'pb-6 mb-8'}`}>
      <div className="flex items-center space-x-4">
        <div className={`${compact ? 'w-9 h-9' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20`}>
          <Image
            src="/assets/icon-star.svg"
            alt="Contribute"
            width={24}
            height={24}
            className="text-white"
          />
        </div>
        <div>
          <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-bold text-white tracking-tight`}>
            Contribute to Mission
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">{missionName}</p>
        </div>
      </div>
      <button
        type="button"
        className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 border border-transparent hover:border-white/10"
        onClick={onClose}
      >
        <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
      </button>
    </div>
  )
}
