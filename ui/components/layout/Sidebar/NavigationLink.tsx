import { Disclosure, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { isGroupActive, type NavGroup } from '@/lib/navigation/nav-config'
import { NavLink } from '../NavLink'

type NavigationLinkProps = {
  item: NavGroup
  setSidebarOpen?: (open: boolean) => void
  index?: number
}

const NavigationLink = ({
  item,
  setSidebarOpen,
  index = 0,
}: NavigationLinkProps) => {
  const router = useRouter()
  const { t } = useTranslation('common')

  if (!item) return null

  const close = () => setSidebarOpen && setSidebarOpen(false)
  const isActive = isGroupActive(item, router.pathname)

  return (
    <li
      className="list-none font-RobotoMono font-normal text-sm md:text-base text-white animate-slideInLeft"
      style={{
        animationDelay: `${index * 0.1}s`,
        animationFillMode: 'both',
      }}
    >
      <Disclosure as="div" className="tracking-tighter" defaultOpen={false}>
        {({ open }) => (
          <>
            {/* The label navigates and the chevron expands, as separate
                controls. Previously the whole row was a Disclosure.Button that
                pushed a route from an inner div's onClick while also toggling
                the panel, so opening the menu and leaving the page were the
                same gesture. */}
            <div
              className={`${
                isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
              } group flex items-center rounded-md font-medium`}
            >
              <NavLink
                href={item.href}
                onClick={close}
                className="flex flex-1 items-center px-2 py-2 text-white cursor-pointer"
              >
                <item.icon
                  className={`mr-2 h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-moon-gold' : 'text-white/70'
                  }`}
                />
                {t(item.name)}
              </NavLink>
              {item.children.length > 0 && (
                <Disclosure.Button
                  aria-label={`${item.name} menu`}
                  className="px-3 py-2 text-white"
                >
                  <ChevronRightIcon
                    className={`${
                      open ? 'rotate-90' : ''
                    } h-5 w-5 transition-transform duration-150 text-white`}
                    aria-hidden="true"
                  />
                </Disclosure.Button>
              )}
            </div>

            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Disclosure.Panel as="ul" className="pl-10">
                {item.children.map((child) => (
                  <li
                    key={child.href}
                    className="list-disc marker:text-white group transition-all duration-150"
                  >
                    <NavLink
                      href={child.href}
                      onClick={close}
                      className={`w-full text-left block ${
                        router.asPath === child.href
                          ? 'text-moon-gold'
                          : 'text-white/60 hover:text-white'
                      } my-3 flex items-center transition-colors duration-200`}
                    >
                      {child.name}
                    </NavLink>
                  </li>
                ))}
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
    </li>
  )
}

export default NavigationLink
