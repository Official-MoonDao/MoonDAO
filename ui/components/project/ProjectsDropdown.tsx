import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from '@headlessui/react'
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline'
import { Fragment } from 'react'
import { Project } from '@/lib/project/useProjectData'

type ProjectsDropdownProps = {
  projects: Project[] | undefined
  selectedProject: Project | undefined
  setSelectedProject: (project: Project) => void
}

export default function ProjectsDropdown({
  projects,
  selectedProject,
  setSelectedProject,
}: ProjectsDropdownProps) {
  return (
    <>
      <Menu as="div" className="relative inline-block">
        <MenuButton className="w-full">
          <div className="inline-flex w-full justify-end rounded-md sm:hidden">
            <EllipsisVerticalIcon
              className="h-7 w-7 text-purple-400"
              aria-hidden="true"
            />
          </div>

          <div className="hidden w-full justify-center gap-x-1.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-500/30 hover:border-purple-500/50 px-4 py-3 text-sm font-RobotoMono text-purple-400 hover:text-purple-300 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] sm:inline-flex">
            {selectedProject?.name || 'Select Project'}
          </div>
        </MenuButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <MenuItems className="absolute z-20 right-0 mt-2 w-56 origin-top-right divide-y divide-white/10 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl ring-1 ring-black/5 focus:outline-none">
            <div className="px-1 py-1">
              <MenuItem>
                {({ focus }) => (
                  <div className="flex flex-col gap-2 overflow-y-scroll max-h-60">
                    {projects?.map((aP: any) => (
                      <button
                        key={aP.id}
                        className="text-sm text-white hover:text-purple-300 hover:bg-white/10 p-2 rounded-lg transition-all duration-200 text-left"
                        type="button"
                        onClick={() => {
                          setSelectedProject(aP)
                        }}
                      >
                        {aP.name}
                      </button>
                    ))}
                  </div>
                )}
              </MenuItem>
            </div>
          </MenuItems>
        </Transition>
      </Menu>
    </>
  )
}
