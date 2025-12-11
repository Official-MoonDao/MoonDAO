import Image from 'next/image'
import { XMarkIcon } from '@heroicons/react/20/solid'

interface MissionContributeModalHeaderProps {
  missionName?: string
  onClose: () => void
}

export function MissionContributeModalHeader({
  missionName,
  onClose,
}: MissionContributeModalHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
          <Image
            src="/assets/icon-star.svg"
            alt="Contribute"
            width={20}
            height={20}
            className="text-white"
          />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Contribute to Mission</h2>
          <p className="text-gray-300 text-sm">{missionName}</p>
        </div>
      </div>
      <button
        type="button"
        className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
        onClick={onClose}
      >
        <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
      </button>
    </div>
  )
}

