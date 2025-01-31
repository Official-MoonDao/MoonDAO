import { Disclosure, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'

//Checks if the navigation object has a property 'external' set to true, if so returns a link that opens another tab, otherwise checks if the navigation object has children. If it does, it returns the dropdown, if it doesn't it returns an internal navigation link.

const NavigationLink = ({ item, setSidebarOpen }: any) => {
  const router = useRouter()
  const { t } = useTranslation('common')
  if (!item) return <></>
  return (
    <li
      className={`list-none font-RobotoMono font-normal text-sm md:text-base text-black dark:text-gray-100`}
      key={item.name}
    >
      {item.external ? (
        <Link
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          passHref
        >
          <div
            className={`
               hover:bg-blue-100   dark:hover:bg-gray-900 
            group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150 cursor-pointer`}
          >
            <item.icon className="mr-2 h-5 w-5 flex-shrink-0 text-black dark:text-white" />
            {t(item.name)}
          </div>
        </Link>
      ) : !item.children ? (
        <Link href={item.href} passHref>
          <div
            className={`${
              router.pathname == item.href
                ? 'bg-blue-200 text-blue-950 dark:bg-slate-950 dark:text-white font-semibold'
                : ' hover:bg-blue-100 dark:hover:bg-gray-900 '
            } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150 cursor-pointer`}
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
          >
            <item.icon
              className={`mr-2 h-5 w-5 flex-shrink-0   ${
                router.pathname == item.href
                  ? 'text-blue-950 dark:text-white'
                  : 'text-black dark:text-white'
              }`}
            />
            {t(item.name)}
          </div>
        </Link>
      ) : (
        <Dropdown item={item} router={router} setSidebarOpen={setSidebarOpen} />
      )}
    </li>
  )
}

const Dropdown = ({ item, router, setSidebarOpen }: any) => {
  return (
    <Disclosure
      className="tracking-tighter"
      as="div"
      defaultOpen={
        item?.children?.some((e: any) => e.href === router.pathname) ||
        item.href === '/join'
      }
      onClick={({ target }: any) => {
        if (item.href) {
          const expanded = target.getAttribute('aria-expanded')
          if (expanded === 'false') router.push(item.href)
        }
      }}
    >
      {({ open }) => (
        <>
          <Disclosure.Button
            className={`${
              item?.children
                ?.map((e: any) => e.href)
                ?.includes(router.pathname) || router.pathname == item.href
                ? 'bg-blue-200 text-blue-950 dark:bg-gray-950 dark:text-white hover:scale-100 font-semibold'
                : ' hover:bg-blue-100  dark:hover:bg-gray-900'
            } w-full group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150`}
          >
            <div
              className="flex"
              onClick={(e) => {
                open && e.stopPropagation()
                item.href && router.push(item.href)
              }}
            >
              <item.icon
                className={`mr-2 h-5 w-5  ${item?.children
                  ?.map((e: any) => e.href)
                  ?.includes(router.pathname)}`}
                aria-hidden="true"
              />
              {item.name}
            </div>
            <span className="ml-4">
              <ChevronRightIcon
                className={`
            ${open && 'rotate-90'}
            'h-5 w-5 translate-all duration-150 text-white'
            `}
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
            <Disclosure.Panel as="ul" className="pl-10">
              {item.children.map((subItem: any) => {
                if (subItem.href) {
                  return (
                    <li
                      key={subItem.name}
                      className="list-disc marker:text-blue-950 dark:marker:text-white group hover:scale-105 transition-all duration-150"
                      onClick={() => setSidebarOpen && setSidebarOpen(false)}
                    >
                      <Link
                        href={subItem.href}
                        className={`${
                          router.asPath == subItem.href ||
                          router.asPath == subItem.dynamicHref
                            ? 'text-blue-950 dark:text-white font-semibold'
                            : '  dark:text-white'
                        } my-3 flex items-center`}
                      >
                        {subItem.name}
                      </Link>
                    </li>
                  )
                } else {
                  return (
                    <p
                      className="relative right-[15%] text-[75%] opacity-75"
                      key={subItem.name}
                    >
                      {subItem.name}
                    </p>
                  )
                }
              })}
            </Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}

export default NavigationLink
