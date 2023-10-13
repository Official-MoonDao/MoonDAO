import { Disclosure, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'

//Checks if the navigation object has a property 'external' set to true, if so returns a link that opens another tab, otherwise checks if the navigation object has children. If it does, it returns the dropdown, if it doesn't it returns an internal navigation link.

const NavigationLink = ({ item }: any) => {
  const router = useRouter()
  const { t } = useTranslation('common')
  return (
    <li
      className={`list-none font-RobotoMono font-normal text-[16px] text-gray-600 dark:text-gray-100`}
      key={item.name}
    >
      {item.external ? (
        <Link href={item.href} target="_blank" rel="noopener noreferrer">
          <div
            className={`
               hover:bg-blue-100 hover:text-gray-700  dark:hover:bg-gray-900 dark:hover:text-gray-200
            group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150 cursor-pointer`}
          >
            <item.icon className="mr-2 h-5 w-5 flex-shrink-0 text-blue-500 dark:text-white" />
            {t(item.name)}
          </div>
        </Link>
      ) : !item.children ? (
        <Link href={item.href} legacyBehavior>
          <div
            className={`${
              router.pathname == item.href
                ? 'bg-blue-200 text-blue-950 dark:bg-slate-950 dark:text-moon-orange font-semibold'
                : ' hover:bg-blue-100 hover:text-gray-700  dark:hover:bg-gray-900 dark:hover:text-gray-200'
            } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150 cursor-pointer`}
          >
            <item.icon
              className={`mr-2 h-5 w-5 flex-shrink-0 text-blue-500  ${
                router.pathname == item.href
                  ? 'dark:text-moon-orange'
                  : 'dark:text-white'
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
      as="div"
      defaultOpen={item?.children?.some((e: any) => e.href !== router.pathname)}
    >
      {({ open }) => (
        <>
          <Disclosure.Button
            className={`${
              item?.children?.map((e: any) => e.href)?.includes(router.pathname)
                ? 'bg-blue-200 text-blue-950 dark:bg-gray-950 dark:text-moon-orange hover:scale-100 font-semibold'
                : ' hover:bg-blue-100 hover:text-gray-700  dark:hover:bg-gray-900 dark:hover:text-gray-200'
            } w-full group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150`}
          >
            <item.icon
              className="mr-2 h-5 w-5 text-blue-500 dark:text-white"
              aria-hidden="true"
            />
            {item.name}
            <span className="ml-4">
              <ChevronRightIcon
                className={`
            ${open ? 'rotate-90 text-gray-500' : 'text-gray-400'}
            'h-5 w-5 translate-all duration-150'
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
                  className="list-disc marker:text-detail-light dark:marker:text-moon-orange group hover:scale-105 transition-all duration-150"
                >
                  <Link
                    href={subItem.href}
                    className={`${
                      router.pathname == subItem.href
                        ? 'text-moon-blue dark:text-moon-orange font-semibold'
                        : ' hover:text-gray-700 dark:hover:text-gray-200'
                    } my-3 flex items-center text-[15px] font-medium dark:text-gray-400`}
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
