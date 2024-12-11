import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from '@headlessui/react'
import {
  ShareIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ChevronDownIcon,
  TrashIcon,
  ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'
import { Chain } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import ProjectABI from 'const/abis/Project.json'
import { PROJECT_TABLE_ADDRESSES, TABLELAND_ENDPOINT } from 'const/config'
import { Fragment, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import useNewestProposals from '@/lib/nance/useNewestProposals'

type ActiveProjectsDropdownProps = {
  selectedChain: Chain
  setProposalId: (id: string) => void
}

export default function ActiveProjectsDropdown({
  selectedChain,
  setProposalId,
}: ActiveProjectsDropdownProps) {
  const [activeProjects, setActiveProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState<any>()
  const { contract: projectsTableContract } = useContract(
    PROJECT_TABLE_ADDRESSES[selectedChain.slug],
    ProjectABI
  )

  useEffect(() => {
    async function getActiveProjects() {
      const projectsTableName = await projectsTableContract?.call(
        'getTableName'
      )
      const statement = `SELECT * FROM ${projectsTableName}`
      const projectsRes = await fetch(
        `${TABLELAND_ENDPOINT}?statement=${statement}`
      )
      const projects = await projectsRes.json()
      setActiveProjects(projects)
    }
    if (projectsTableContract) {
      getActiveProjects()
    }
  }, [projectsTableContract])
  return (
    <>
      <Menu as="div" className="relative inline-block">
        <MenuButton>
          <div className="inline-flex w-full justify-end rounded-md sm:hidden">
            <EllipsisVerticalIcon
              className="h-7 w-7 text-indigo-600"
              aria-hidden="true"
            />
          </div>

          <div className="hidden w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:inline-flex">
            {selectedProject?.title || 'Select Project'}
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
                    {activeProjects.map((aP: any) => (
                      <button
                        key={aP.id}
                        className="text-sm text-black"
                        onClick={() => {
                          setSelectedProject(aP)
                          setProposalId(aP.MDP)
                        }}
                      >
                        {aP.title}
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
