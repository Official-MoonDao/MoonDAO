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
      className={`list-none font-RobotoMono font-normal text-sm md:text-base animate-slideInLeft`}
      key={item.name}
      style={{
        animationDelay: `${index * 0.1}s`,
        animationFillMode: 'both',
        color: '#c0ffe0',
      }}
    >
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center px-2 py-2 font-medium cursor-pointer transition-all duration-200 uppercase tracking-wider text-xs"
          style={{
            color: '#b0ffe0',
            fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#00ffc8'
            e.currentTarget.style.textShadow = '0 0 8px rgba(0, 255, 200, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#b0ffe0'
            e.currentTarget.style.textShadow = 'none'
          }}
        >
          <item.icon className="mr-2 h-5 w-5 flex-shrink-0" style={{ color: 'inherit' }} />
          {t(item.name)}
        </a>
      ) : !hasDropdown ? (
        <NavLink
          href={item.href}
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
          className={`w-full text-left group flex items-center px-2 py-2 font-medium transition-all duration-200 cursor-pointer uppercase tracking-wider text-xs`}
          style={{
            fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
            ...(router.pathname == item.href
              ? {
                  color: '#00ffc8',
                  textShadow: '0 0 8px rgba(0, 255, 200, 0.5)',
                  background: 'rgba(0, 255, 200, 0.05)',
                  borderLeft: '2px solid #00ffc8',
                  boxShadow: 'inset 3px 0 8px rgba(0, 255, 200, 0.1)',
                }
              : {
                  color: '#b0ffe0',
                }),
          }}
        >
          <item.icon
            className="mr-2 h-5 w-5 flex-shrink-0"
            style={{ color: 'inherit' }}
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

  const isActive = isChildrenActive || isTeamsActive || isProjectsActive

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
            className="w-full group flex items-center px-2 py-2 font-medium transition-all duration-200 uppercase tracking-wider text-xs"
            style={{
              fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
              ...(isActive
                ? {
                    color: '#00ffc8',
                    textShadow: '0 0 8px rgba(0, 255, 200, 0.5)',
                    background: 'rgba(0, 255, 200, 0.05)',
                    borderLeft: '2px solid #00ffc8',
                    boxShadow: 'inset 3px 0 8px rgba(0, 255, 200, 0.1)',
                  }
                : {
                    color: '#b0ffe0',
                  }),
            }}
          >
            <div
              className="flex"
              onClick={(e) => {
                open && e.stopPropagation()
                if (item.href && !hasDynamicTeams && !hasDynamicProjects)
                  router.push(item.href)
              }}
            >
              <item.icon className="mr-2 h-5 w-5" aria-hidden="true" style={{ color: 'inherit' }} />
              {item.name}
            </div>
            <span className="ml-4">
              <ChevronRightIcon
                className={`${open && 'rotate-90'} h-5 w-5 transition-all duration-150`}
                style={{ color: '#90ddc0' }}
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
                        className="list-none group transition-all duration-150"
                        onClick={() => setSidebarOpen && setSidebarOpen(false)}
                        style={{ borderLeft: '1px solid rgba(0, 255, 200, 0.1)' }}
                      >
                        <NavLink
                          href={subItem.href}
                          onClick={() => setSidebarOpen && setSidebarOpen(false)}
                          className="w-full text-left block my-3 flex items-center transition-colors duration-200 text-xs uppercase tracking-wider"
                          style={{
                            fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
                            paddingLeft: '8px',
                            ...(router.asPath == subItem.href ||
                            router.asPath == subItem.dynamicHref
                              ? {
                                  color: '#00ffc8',
                                  textShadow: '0 0 6px rgba(0, 255, 200, 0.3)',
                                }
                              : {
                                  color: '#90ddc0',
                                }),
                          }}
                        >
                          {subItem.name}
                        </NavLink>
                      </li>
                    )
                  } else {
                    return (
                      <p
                        className="relative right-[15%] text-[75%] opacity-75"
                        key={subItem.name}
                        style={{ color: '#ff9f1c', fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600 }}
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
