import Link from 'next/link'
import { RocketLaunchIcon } from '@heroicons/react/24/outline'
import StandardButton from '@/components/layout/StandardButton'
import { Project } from '@/lib/project/useProjectData'

type DashboardActiveProjectsProps = {
  currentProjects: Project[]
  ethBudget?: number
  showBudget?: boolean
  maxProjects?: number
}

export default function DashboardActiveProjects({
  currentProjects,
  ethBudget,
  showBudget = true,
  maxProjects = 6,
}: DashboardActiveProjectsProps) {
  return (
    <div className="bg-gradient-to-br from-green-600/20 to-emerald-800/20 backdrop-blur-xl border border-green-500/20 rounded-2xl p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div>
            <h3 className="text-3xl font-bold text-white flex items-center gap-3 mb-3">
              <RocketLaunchIcon className="w-8 h-8" />
              Active Projects
            </h3>
            <p className="text-green-200 text-base">
              Contribute to space exploration initiatives and make history
            </p>
          </div>

          {/* Stats next to title */}
          <div className="flex gap-4">
            {showBudget && ethBudget !== undefined && (
              <div className="bg-black/20 rounded-xl px-5 py-3 border border-green-500/20">
                <div className="text-xl font-bold text-white">
                  {Math.round(ethBudget)} ETH
                </div>
                <div className="text-green-200 text-sm">Quarterly Budget</div>
              </div>
            )}
            <div className="bg-black/20 rounded-xl px-5 py-3 border border-green-500/20">
              <div className="text-xl font-bold text-white">
                {currentProjects?.length || 0}
              </div>
              <div className="text-green-200 text-sm">Total Projects</div>
            </div>
          </div>
        </div>

        {/* Buttons on the right */}
        <div className="flex gap-4">
          <StandardButton
            className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-8 py-4 rounded-xl font-medium transition-all text-base"
            link="/proposals"
          >
            Propose Project
          </StandardButton>
          <StandardButton
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg transition-all text-base"
            link="/projects"
          >
            View All Projects
          </StandardButton>
        </div>
      </div>

      {currentProjects && currentProjects.length > 0 ? (
        <div>
          {/* Projects Grid - Larger cards with fewer columns for better visibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentProjects.slice(0, maxProjects).map((project: any, index: number) => (
              <Link key={index} href={`/project/${project.id}`} passHref>
                <div className="bg-black/30 rounded-xl p-6 border border-green-500/10 cursor-pointer hover:bg-black/40 hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 min-h-[200px] flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-white text-lg flex-1 mr-3 leading-tight">
                      {project.name}
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
                  <p className="text-green-100 text-sm leading-relaxed flex-1 overflow-hidden">
                    {project.description?.length > 180
                      ? `${project.description.substring(0, 180)}...`
                      : project.description || 'No description available'}
                  </p>
                  <div className="mt-4 pt-4 border-t border-green-500/10">
                    <div className="text-green-300 text-xs font-medium hover:text-green-200 transition-colors">
                      Click to view details →
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Show more projects indicator if there are more than maxProjects */}
            {currentProjects.length > maxProjects && (
              <div className="bg-black/30 rounded-xl p-6 border border-green-500/10 min-h-[200px] flex items-center justify-center hover:bg-black/40 hover:border-green-500/20 transition-all duration-300">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-300 mb-2">
                    +{currentProjects.length - maxProjects}
                  </div>
                  <p className="text-green-200 text-sm mb-4">
                    More Projects Available
                  </p>
                  <StandardButton
                    className="bg-green-600/30 hover:bg-green-600/50 text-green-300 text-sm px-6 py-3 rounded-xl transition-all font-medium"
                    link="/projects"
                  >
                    View All Projects
                  </StandardButton>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-black/20 rounded-xl p-12 border border-green-500/20 min-h-[300px] flex items-center justify-center">
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
              <StandardButton
                className="bg-green-600/20 hover:bg-green-600/40 text-green-300 px-8 py-3 rounded-xl transition-all font-medium"
                link="/projects"
              >
                View All Projects
              </StandardButton>
              <StandardButton
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-8 py-3 rounded-xl transition-all font-medium"
                link="/proposals"
              >
                Propose a Project
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
