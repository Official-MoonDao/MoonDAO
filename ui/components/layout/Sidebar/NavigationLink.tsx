import {
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'
import Link from 'next/link'
import { useRouter } from 'next/router'

const NavigationLink = ({ item }: any) => {
  const router = useRouter()
  const { t } = useTranslation('common')

  return (
    <li className={`list-none`} key={item.href}>
      <Link href={item.href}>
        <a
          className={`${
            router.pathname == item.href
              ? 'bg-blue-200 text-blue-950 dark:bg-gray-800 dark:text-gray-50 hover:scale-100'
              : 'text-gray-600 hover:bg-blue-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-200'
          } group flex items-center rounded-md px-2 py-2 font-medium hover:scale-105 transition-all duration-150`}
        >
          <item.icon className=" mr-3 h-6 w-6 flex-shrink-0 text-blue-500 dark:text-moon-gold" />
          {t(item.name)}
        </a>
      </Link>
    </li>
  )
}

export default NavigationLink
