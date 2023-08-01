import { Disclosure, Transition } from '@headlessui/react'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const NavigationLink = ({ item }: any) => {
  const router = useRouter()
  const { t } = useTranslation('common')
  return (
    <li className={`list-none`} key={item.name}>
      {!item.children ? (
        <Link href={item.href} legacyBehavior>
          <div
            className={`${
              router.pathname == item.href
                ? 'bg-blue-200 text-blue-950 dark:bg-gray-800 dark:text-gray-50 hover:scale-100'
                : 'text-gray-600 hover:bg-blue-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-200'
            } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150 cursor-pointer`}
          >
            <item.icon className="mr-3 h-6 w-6 flex-shrink-0 text-blue-500 dark:text-moon-gold" />
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
      defaultOpen={item?.children?.some((e: any) => e.href === router.pathname)}
    >
      {({ open }) => (
        <>
          <Disclosure.Button
            className={`${
              item?.children?.map((e: any) => e.href)?.includes(router.pathname)
                ? 'bg-blue-200 text-blue-950 dark:bg-gray-800 dark:text-gray-50 hover:scale-100'
                : 'text-gray-600 hover:bg-blue-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-200'
            } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150`}
          >
            <item.icon
              className="mr-3 h-6 w-6 text-blue-500 dark:text-moon-gold"
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
                  className="list-disc marker:text-detail-light dark:marker:text-yellow-100 group"
                >
                  <a
                    href={subItem.href}
                    className={`${
                      router.pathname == subItem.href
                        ? 'text-moon-blue dark:text-moon-gold'
                        : 'text-gray-600  hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-200'
                    } my-3 flex items-center text-[15px] font-medium dark:text-gray-400 dark:hover:text-white`}
                  >
                    {subItem.name}
                  </a>
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
