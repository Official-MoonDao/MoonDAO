import Link from 'next/link'
import { useRouter } from 'next/router'
import { ChevronRightIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import useTranslation from 'next-translate/useTranslation'


const NavigationLink = ({item}:any) => {
  const router = useRouter()
  const { t } = useTranslation('common')

return (
    <li
      className={`mt-1 relative py-2`}
      key={item.href}
    >
      {item.href.charAt(0) === '/' ? (
        <Link href={item.href}>
          <a
            className={`py-4 ${
              router.pathname == item.href ? 'active' : ''
            }`}
          >
             <item.icon className="h-5 w-5" />
            {t(item.name)}
            <ChevronRightIcon className="h-5 w-5 absolute right-4 opacity-50" />
          </a>
        </Link>
      ) : (
        <a
          className={`py-4 ${router.pathname == item.href ? 'active' : ''}`}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <item.icon className="h-5 w-5"/>
          {t(item.name)}
          <ArrowTopRightOnSquareIcon className="h-5 w-5 absolute right-4 opacity-50" />
        </a>
      )}
    </li>
  )
}

export default NavigationLink
