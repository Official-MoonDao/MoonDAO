import { Disclosure, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

//Checks if the navigation object has a property 'external' set to true, if so returns a link that opens another tab, otherwise checks if the navigation object has children. If it does, it returns the dropdown, if it doesn't it returns an internal navigation link.

const NavigationLink = ({ item }: any) => {
  const router = useRouter()
  const { t } = useTranslation('common')
  return (
    <li
      className={`list-none font-RobotoMono font-normal text-sm md:text-base text-black dark:text-gray-100`}
      key={item.name}
    >
      {item.external ? (
        <Link href={item.href} target="_blank" rel="noopener noreferrer">
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
        <Link href={item.href} legacyBehavior>
          <div
            className={`${
              router.pathname == item.href
                ? 'bg-blue-200 text-blue-950 dark:bg-slate-950 dark:text-moon-orange font-semibold'
                : ' hover:bg-blue-100 dark:hover:bg-gray-900 '
            } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150 cursor-pointer`}
          >
            <item.icon
              className={`mr-2 h-5 w-5 flex-shrink-0   ${
                router.pathname == item.href
                  ? 'text-blue-950 dark:text-moon-orange'
                  : 'text-black dark:text-white'
              }`}
            />
            {t(item.name)}
          </div>
        </Link>
      ) : (
        <Dropdown item={item} router={router} />
      )}
    </li>
  )
}

const Dropdown = ({ item, router }: any) => {
  return (
    <Disclosure
      className="tracking-tighter"
      as="div"
      defaultOpen={item?.children?.some((e: any) => e.href === router.pathname)}
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
                ? 'bg-blue-200 text-blue-950 dark:bg-gray-950 dark:text-moon-orange hover:scale-100 font-semibold'
                : ' hover:bg-blue-100  dark:hover:bg-gray-900'
            } w-full group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150`}
          >
            <item.icon
              className={`mr-2 h-5 w-5  ${item?.children
                ?.map((e: any) => e.href)
                ?.includes(router.pathname)}`}
              aria-hidden="true"
            />
            {item.name}
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
              {item.children.map((subItem: any) => (
                <li
                  key={subItem.name}
                  className="list-disc marker:text-blue-950 dark:marker:text-moon-orange group hover:scale-105 transition-all duration-150"
                >
                  <Link
                    href={subItem.href}
                    className={`${
                      router.pathname == subItem.href ||
                      router.pathname == subItem.dynamicHref
                        ? 'text-blue-950 dark:text-moon-orange font-semibold'
                        : '  dark:text-white'
                    } my-3 flex items-center`}
                  >
                    {subItem.name}
                  </Link>
                </li>
              ))}
            </Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}

export default NavigationLink
