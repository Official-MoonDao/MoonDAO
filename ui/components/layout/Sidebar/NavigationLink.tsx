import { Disclosure, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import useTranslation from 'next-translate/useTranslation'
import { NavLink } from '../NavLink'
import { useRouter } from 'next/router'
import { TeamsNavDropdown } from './TeamsNavDropdown'
import { ProjectsNavDropdown } from './ProjectsNavDropdown'

const NavigationLink = ({ item, setSidebarOpen, index = 0 }: any) => {
  const router = useRouter()
  const { t } = useTranslation('common')
  if (!item) return <></>
  const hasDropdown = item.children || item.dynamicChildren
  return (
    <li
      className={`list-none font-RobotoMono font-normal text-sm md:text-base text-white animate-slideInLeft`}
      key={item.name}
      style={{
        animationDelay: `${index * 0.1}s`,
        animationFillMode: 'both'
      }}
    >
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`
             hover:bg-white/10 transition-all duration-200
          group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 cursor-pointer`}
        >
          <item.icon className="mr-2 h-5 w-5 flex-shrink-0 text-white" />
          {t(item.name)}
        </a>
      ) : !hasDropdown ? (
        <NavLink
          href={item.href}
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
          className={`w-full text-left ${
            router.pathname == item.href
              ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-white border border-blue-400/50 font-semibold'
              : 'hover:bg-white/10 text-white'
          } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-200 cursor-pointer`}
        >
          <item.icon
            className={`mr-2 h-5 w-5 flex-shrink-0 text-white`}
          />
          {t(item.name)}
        </NavLink>
      ) : (
        <Dropdown
          item={item}
          router={router}
          setSidebarOpen={setSidebarOpen}
          hasDynamicTeams={item.dynamicChildren === 'Teams'}
          hasDynamicProjects={item.dynamicChildren === 'Projects'}
        />
      )}
    </li>
  )
}

const Dropdown = ({
  item,
  router,
  setSidebarOpen,
  hasDynamicTeams,
  hasDynamicProjects,
}: any) => {
  const isTeamsActive =
    hasDynamicTeams &&
    (router.pathname.startsWith('/team') ||
      router.pathname === '/join' ||
      router.pathname === '/jobs' ||
      router.pathname === '/marketplace' ||
      (router.pathname === '/network' && router.query.tab === 'teams'))
  const isProjectsActive =
    hasDynamicProjects &&
    (router.pathname.startsWith('/project') ||
      router.pathname === '/projects' ||
      router.pathname === '/proposals' ||
      router.pathname === '/contributions' ||
      router.pathname === '/projects-overview')
  const isNetworkTeams =
    router.pathname === '/network' && router.query.tab === 'teams'
  const isChildrenActive =
    !isNetworkTeams &&
    (item?.children?.some((e: any) => e.href === router.pathname) ||
      item.href === router.pathname)

  return (
    <Disclosure
      className="tracking-tighter"
      as="div"
      defaultOpen={
        isChildrenActive || isTeamsActive || isProjectsActive || item.href === '/join'
      }
      onClick={({ target }: any) => {
        if (item.href && !hasDynamicTeams && !hasDynamicProjects) {
          const expanded = target.getAttribute('aria-expanded')
          if (expanded === 'false') router.push(item.href)
        }
      }}
    >
      {({ open }) => (
        <>
          <Disclosure.Button
            className={`${
              isChildrenActive || isTeamsActive || isProjectsActive
                ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-white border border-blue-400/50 hover:scale-100 font-semibold'
                : 'hover:bg-white/10 text-white'
            } w-full group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-200`}
          >
            <div
              className="flex"
              onClick={(e) => {
                open && e.stopPropagation()
                if (item.href && !hasDynamicTeams && !hasDynamicProjects)
                  router.push(item.href)
              }}
            >
              <item.icon className="mr-2 h-5 w-5" aria-hidden="true" />
              {item.name}
            </div>
            <span className="ml-4">
              <ChevronRightIcon
                className={`${open && 'rotate-90'} h-5 w-5 transition-all duration-150 text-white`}
                aria-hidden="true"
              />
            </span>
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel as="div" className="pl-10">
              {hasDynamicTeams ? (
                <div onClick={() => setSidebarOpen && setSidebarOpen(false)}>
                  <TeamsNavDropdown
                  variant="mobile"
                  onNavigate={() => setSidebarOpen && setSidebarOpen(false)}
                  />
                </div>
              ) : hasDynamicProjects ? (
                <div onClick={() => setSidebarOpen && setSidebarOpen(false)}>
                  <ProjectsNavDropdown
                  variant="mobile"
                  onNavigate={() => setSidebarOpen && setSidebarOpen(false)}
                  />
                </div>
              ) : (
                item.children?.map((subItem: any) => {
                  if (subItem.href) {
                    return (
                      <li
                        key={subItem.name}
                        className="list-disc marker:text-white group hover:scale-105 transition-all duration-150"
                        onClick={() => setSidebarOpen && setSidebarOpen(false)}
                      >
                        <NavLink
                          href={subItem.href}
                          onClick={() => setSidebarOpen && setSidebarOpen(false)}
                          className={`w-full text-left block ${
                            router.asPath == subItem.href ||
                            router.asPath == subItem.dynamicHref
                              ? 'text-blue-300 font-semibold'
                              : 'text-gray-300 hover:text-white'
                          } my-3 flex items-center transition-colors duration-200`}
                        >
                          {subItem.name}
                        </NavLink>
                      </li>
                    )
                  } else {
                    return (
                      <p
                        className="relative right-[15%] text-[75%] opacity-75 text-gray-400"
                        key={subItem.name}
                      >
                        {subItem.name}
                      </p>
                    )
                  }
                })
              )}
            </Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}

export default NavigationLink
