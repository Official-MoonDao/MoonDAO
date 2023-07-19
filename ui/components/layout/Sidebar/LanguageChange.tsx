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
      <p className="font-medium text-blue-700 dark:text-yellow-200">
        Language: CN ↔ EN
      </p>
      <li className="mt-2 py-2 bg-moon-blue dark:bg-moon-gold rounded-lg text-white pl-3 hover:scale-105 transition-all duration-150 shadow shadow-detail-light dark:shadow-detail-dark">
        {currentLang === 'en' ? (
          <Link href="/" locale="zh">
            <a className="flex gap-5" onClick={(e) => changeLang(e, 'zh')}>
              <CNAsset />
              切换到中文
            </a>
          </Link>
        ) : (
          <Link href="/" locale="en">
            <a className="flex gap-5" onClick={(e) => changeLang(e, 'en')}>
              <CNAsset />
              Switch to English
            </a>
          </Link>
        )}
      </li>
    </>
  )
}

export default LanguageChange
