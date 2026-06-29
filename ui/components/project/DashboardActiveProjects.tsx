import Link from 'next/link'
import { RocketLaunchIcon } from '@heroicons/react/24/outline'
import { getProjectDisplayName } from '@/lib/project/getProjectDisplayName'
import { Project } from '@/lib/project/useProjectData'
import { getRelativeQuarter } from '@/lib/utils/dates'

type DashboardActiveProjectsProps = {
  currentProjects: Project[]
  usdBudget?: number
  showBudget?: boolean
  maxProjects?: number
}

export default function DashboardActiveProjects({
  currentProjects,
  usdBudget,
  showBudget = true,
  maxProjects = 6,
}: DashboardActiveProjectsProps) {
  const { quarter, year } = getRelativeQuarter(0)
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 mt-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
              <RocketLaunchIcon className="w-6 h-6 text-green-400" />
              Active Projects
            </h3>
            <p className="text-white/40 text-sm">
              Contribute to space exploration initiatives
            </p>
          </div>

          {/* Stats next to title */}
          <div className="flex gap-3">
            {showBudget && usdBudget !== undefined && (
              <div className="bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
                <div className="text-lg font-bold text-white">
                  ${Number(usdBudget).toLocaleString()}
                </div>
                <div className="text-white/40 text-xs">Q{quarter} {year} Budget</div>
              </div>
            )}
            <div className="bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
              <div className="text-lg font-bold text-white">
                {currentProjects?.length || 0}
              </div>
              <div className="text-white/40 text-xs">Total Projects</div>
            </div>
          </div>
        </div>

        {/* Buttons on the right */}
        <div className="flex gap-2">
          <Link
            href="/proposals"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
          >
            Propose Project
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap bg-green-500/10 hover:bg-green-500/20 text-green-200 border-green-400/20"
          >
            View All →
          </Link>
        </div>
      </div>

      {currentProjects && currentProjects.length > 0 ? (
        <div>
          {/* Projects Grid - Larger cards with fewer columns for better visibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentProjects.slice(0, maxProjects).map((project: any, index: number) => (
              <Link key={index} href={`/project/${project.MDP}`} passHref>
                <div className="bg-black/20 rounded-xl p-5 border border-white/5 cursor-pointer hover:bg-white/[0.05] hover:border-white/15 transition-all duration-300 h-[260px] flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-white text-lg flex-1 mr-3 leading-tight line-clamp-2">
                      {getProjectDisplayName(project)}
                    </h4>
                    <span
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 ${
                        project.active
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                      }`}
                    >
                      {project.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed flex-1 overflow-hidden">
                    {project.description?.length > 180
                      ? `${project.description.substring(0, 180)}...`
                      : project.description || 'No description available'}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="text-white/40 text-xs font-medium hover:text-white/70 transition-colors">
                      Click to view details →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-black/20 rounded-xl p-12 border border-white/5 min-h-[200px] flex items-center justify-center">
          <div className="text-center max-w-md">
            <RocketLaunchIcon className="w-20 h-20 text-gray-500 mx-auto mb-6" />
            <h4 className="font-bold text-white text-2xl mb-3">
              No Active Projects
            </h4>
            <p className="text-gray-400 text-base mb-6 leading-relaxed">
              Check back soon for new space exploration initiatives and
              opportunities to contribute to groundbreaking missions
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
              >
                View All Projects
              </Link>
              <Link
                href="/proposals"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
              >
                Propose a Project
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
