import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { serialize } from 'v8'
import { useAnnouncements } from '../../lib/dashboard/hooks'
import { errorToast } from '../../lib/utils/errorToast'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

export default function Announcements() {
  const {
    announcements,
    isLoading,
    error,
    update: updateAnnouncements,
  } = useAnnouncements()

  const firstPostId = '916126920339509268'
  const [lastPostId, setLastPostId] = useState<string>('')
  const intObserver: any = useRef()
  const lastPostRef = useCallback(
    (announcement: any) => {
      if (isLoading) return
      if (intObserver.current) intObserver.current.disconnect()

      intObserver.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && lastPostId !== firstPostId) {
          updateAnnouncements(lastPostId)
        }
      })

      if (announcement) intObserver.current.observe(announcement)
    },
    [isLoading]
  )

  if (error)
    errorToast(
      'Connection with Discord failed. Contact MoonDAO if the problem persists 🚀'
    )

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Announcements" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('announcementsTitle')}
          <Image src={flag} width={36} height={36} alt="" />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('announcementsDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8"></div>
      </div>
    </div>
  )
}

// add locales for Announcements title and desc
