import { GlobeAltIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { CNAsset } from '../../assets'

const LanguageChange = () => {
  const router = useRouter()

  const [currentLang, setCurrentLang] = useState(router.locale)

  const changeLang = (e: any, lang: any) => {
    e.preventDefault()
    setCurrentLang(lang)
    router.push(router.pathname, router.pathname, { locale: lang })
  }

  return (
    <>
      {/*Mobile Menu Top*/}
      <div className="md:hidden">
        <button className="py-2 bg-blue-400 dark:bg-moon-gold rounded-lg text-white px-2 hover:scale-105 transition-all duration-150 shadow shadow-detail-light dark:shadow-detail-dark">
          {currentLang === 'en' ? (
            <Link href="/" locale="zh">
              <a className="flex gap-2" onClick={(e) => changeLang(e, 'zh')}>
                <GlobeAltIcon className="h-6 w-6 text-gray-100 dark:text-stronger-dark" />{' '}
                <span className='opacity-70 dark:opacity-80'>CN</span>↔<span className='text-title-light dark:text-orange-600 font-semibold'>EN</span>
              </a>
            </Link>
          ) : (
            <Link href="/" locale="en">
              <a className="flex gap-2" onClick={(e) => changeLang(e, 'en')}>
                <GlobeAltIcon className="h-6 w-6 text-gray-100 dark:text-stronger-dark" />{' '}
                <span className='text-title-light dark:text-orange-600 font-semibold'>CN</span>↔<span className='opacity-70 dark:opacity-80'>EN</span>
              </a>
            </Link>
          )}
        </button>
      </div>
      {/*Desktop Sidebar*/}
      <div className="hidden md:block">
        <p className="font-medium flex items-center gap-2 text-light-text dark:text-dark-text">
          <GlobeAltIcon className="h-6 w-6 text-blue-700 dark:text-detail-dark" />{' '}
          CN ↔ EN
        </p>
        <li className="mt-2 py-2 bg-moon-blue dark:bg-moon-gold rounded-lg text-white pl-3 hover:scale-105 transition-all duration-150 shadow shadow-detail-light dark:shadow-detail-dark">
          {currentLang === 'en' ? (
            <Link href="/" locale="zh">
              <a className="flex gap-2 lg:gap-4" onClick={(e) => changeLang(e, 'zh')}>
                <CNAsset />
                切换到中文
              </a>
            </Link>
          ) : (
            <Link href="/" locale="en">
              <a className="flex gap-2 lg:gap-4" onClick={(e) => changeLang(e, 'en')}>
                <CNAsset />
                Switch to English
              </a>
            </Link>
          )}
        </li>
      </div>
    </>
  )
}

export default LanguageChange
