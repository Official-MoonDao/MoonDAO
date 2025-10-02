import { XMarkIcon, Cog6ToothIcon, RocketLaunchIcon, BriefcaseIcon, GlobeAmericasIcon, CalendarIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { DashboardPreferences } from '@/lib/dashboard/useDashboardPreferences'

interface DashboardSettingsModalProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  preferences: DashboardPreferences
  updatePreferences: (preferences: Partial<DashboardPreferences>) => void
  resetPreferences: () => void
}

const PREFERENCE_ITEMS = [
  { key: 'showQuests', label: 'Quests', icon: TrophyIcon, color: 'text-yellow-400' },
  { key: 'showProjects', label: 'Projects', icon: RocketLaunchIcon, color: 'text-green-400' },
  { key: 'showJobs', label: 'Jobs', icon: BriefcaseIcon, color: 'text-purple-400' },
  { key: 'showLaunchpad', label: 'Launchpad', icon: RocketLaunchIcon, color: 'text-blue-400' },
  { key: 'showEvents', label: 'Events', icon: CalendarIcon, color: 'text-pink-400' },
  { key: 'showGlobalMap', label: 'Global Map', icon: GlobeAmericasIcon, color: 'text-teal-400' },
]

export default function DashboardSettingsModal({
  isOpen,
  setIsOpen,
  preferences,
  updatePreferences,
  resetPreferences,
}: DashboardSettingsModalProps) {
  if (!isOpen) return null

  const handleToggle = (key: string) => {
    updatePreferences({ [key]: !preferences[key as keyof DashboardPreferences] })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Cog6ToothIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Customize Dashboard</h2>
              <p className="text-xs text-gray-400">Toggle optional sections</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <p className="text-blue-200 text-sm leading-relaxed">
              <strong className="text-blue-100">Core Layout:</strong> The three-column dashboard is always visible. Toggle optional sections below.
            </p>
          </div>

          {/* Grid of Toggle Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PREFERENCE_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = preferences[item.key as keyof DashboardPreferences]
              
              return (
                <button
                  key={item.key}
                  onClick={() => handleToggle(item.key)}
                  className={`relative p-4 rounded-xl transition-all duration-200 border-2 ${
                    isActive
                      ? 'bg-white/10 border-blue-500/50 shadow-lg shadow-blue-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={`w-8 h-8 ${isActive ? item.color : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      {item.label}
                    </span>
                  </div>
                  
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-gray-900/50">
          <button
            onClick={resetPreferences}
            className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
          >
            Reset All
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}
