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
  setProposalId?: (id: string) => void
}

export default function ProjectsDropdown({
  projects,
  selectedProject,
  setSelectedProject,
  setProposalId,
}: ProjectsDropdownProps) {
  return (
    <>
      <Menu as="div" className="relative inline-block">
        <MenuButton className="w-full">
          <div className="inline-flex w-full justify-end rounded-md sm:hidden">
            <EllipsisVerticalIcon
              className="h-7 w-7 text-indigo-600"
              aria-hidden="true"
            />
          </div>

          <div className="hidden w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:inline-flex">
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
          <MenuItems className="absolute z-20 right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
            <div className="px-1 py-1">
              <MenuItem>
                {({ focus }) => (
                  <div className="flex flex-col gap-2 overflow-y-scroll">
                    {projects?.map((aP: any) => (
                      <button
                        key={aP.id}
                        className="text-sm text-black"
                        type="button"
                        onClick={() => {
                          setSelectedProject(aP)
                          setProposalId && setProposalId(aP.MDP)
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
