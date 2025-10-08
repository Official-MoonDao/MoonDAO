import { XMarkIcon, Cog6ToothIcon, RocketLaunchIcon, BriefcaseIcon, GlobeAmericasIcon, CalendarIcon, TrophyIcon, BanknotesIcon, ChartBarIcon, GiftIcon, UserGroupIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { DashboardPreferences } from '@/lib/dashboard/useDashboardPreferences'

interface DashboardSettingsModalProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  preferences: DashboardPreferences
  updatePreferences: (preferences: Partial<DashboardPreferences>) => void
  resetPreferences: () => void
  isSaving?: boolean
}

const PREFERENCE_SECTIONS = [
  {
    title: 'Core Features',
    description: 'Essential dashboard components',
    items: [
      { key: 'showQuests', label: 'Quest System', icon: TrophyIcon, color: 'text-yellow-400' },
    ],
  },
  {
    title: 'Left Sidebar',
    description: 'Analytics and rewards',
    items: [
      { key: 'showWeeklyRewards', label: 'Reward Pool', icon: BanknotesIcon, color: 'text-green-400' },
      { key: 'showMetrics', label: 'DAO Metrics', icon: ChartBarIcon, color: 'text-blue-400' },
    ],
  },
  {
    title: 'Right Sidebar', 
    description: 'Community and marketplace',
    items: [
      { key: 'showClaimRewards', label: 'Claim Rewards', icon: GiftIcon, color: 'text-purple-400' },
      { key: 'showCitizens', label: 'New Citizens', icon: UserGroupIcon, color: 'text-teal-400' },
      { key: 'showTeams', label: 'Featured Teams', icon: UserGroupIcon, color: 'text-orange-400' },
      { key: 'showMarketplace', label: 'Marketplace', icon: ShoppingBagIcon, color: 'text-pink-400' },
    ],
  },
  {
    title: 'Full Width Sections',
    description: 'Major content areas',
    items: [
      { key: 'showProjects', label: 'Projects', icon: RocketLaunchIcon, color: 'text-green-500' },
      { key: 'showJobs', label: 'Jobs', icon: BriefcaseIcon, color: 'text-purple-500' },
      { key: 'showLaunchpad', label: 'Launchpad', icon: RocketLaunchIcon, color: 'text-blue-500' },
      { key: 'showEvents', label: 'Events', icon: CalendarIcon, color: 'text-pink-500' },
      { key: 'showGlobalMap', label: 'Global Map', icon: GlobeAmericasIcon, color: 'text-teal-500' },
    ],
  },
]

export default function DashboardSettingsModal({
  isOpen,
  setIsOpen,
  preferences,
  updatePreferences,
  resetPreferences,
  isSaving = false,
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
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-blue-200 text-sm leading-relaxed">
              <strong className="text-blue-100">Smart Layout:</strong> Columns adapt automatically based on your selections. Center feed is always visible.
            </p>
          </div>

          {/* Organized Sections */}
          {PREFERENCE_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                <p className="text-xs text-gray-400">{section.description}</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = preferences[item.key as keyof DashboardPreferences]
                  
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleToggle(item.key)}
                      className={`relative p-3 rounded-xl transition-all duration-200 border-2 ${
                        isActive
                          ? 'bg-white/10 border-blue-500/50 shadow-lg shadow-blue-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Icon className={`w-6 h-6 ${isActive ? item.color : 'text-gray-400'}`} />
                        <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-400'} text-center leading-tight`}>
                          {item.label}
                        </span>
                      </div>
                      
                      {/* Active Indicator */}
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={resetPreferences}
              disabled={isSaving}
              className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset All
            </button>
            {isSaving && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                Saving to blockchain...
              </div>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
