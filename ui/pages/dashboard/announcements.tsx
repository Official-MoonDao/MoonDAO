import useTranslation from 'next-translate/useTranslation'
import React, { useCallback, useRef } from 'react'
import { useAnnouncements } from '../../lib/dashboard/hooks'
import { errorToast } from '../../lib/utils/errorToast'
import Announcement from '../../components/dashboard/announcements/Announcement'
import AnnouncementSkeletons from '../../components/dashboard/announcements/AnnouncementSkeletons'
import Head from '../../components/layout/Head'
import Header from '../../components/layout/Header'
import Line from '../../components/layout/Line'

export default function Announcements() {
  const { announcements, isLoading, error, updateAnnouncements } =
    useAnnouncements()

  const firstPostId = '916126920339509268'
  const endingId = '916126920339509268'
  const lastPostId = announcements.length
    ? announcements[announcements.length - 1].id
    : ''

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
      <Head
        title={t('announcementsTitle')}
        description={t('announcementsDesc')}
      />
      <Header text={'Announcements'} />
      <Line />

      <div className="mt-[34px]">
        {(isLoading && !announcements.length) || error ? (
          <AnnouncementSkeletons />
        ) : (
          <div id="dashboard-announcements">
            {announcements.length &&
              announcements.map((e: any, i: number) =>
                i + 1 === announcements.length ? (
                  <Announcement
                    ref={lastPostRef}
                    key={e.id}
                    content={e.content}
                    mentions={e.mentions}
                    author={e.author}
                    timestamp={e.timestamp}
                    reactions={e.reactions}
                    attachments={e.attachments}
                  />
                ) : (
                  <Announcement
                    key={e.id}
                    content={e.content}
                    mentions={e.mentions}
                    author={e.author}
                    timestamp={e.timestamp}
                    reactions={e.reactions}
                    attachments={e.attachments}
                  />
                )
              )}

            {lastPostId !== endingId ? (
              <p
                className={`${
                  isLoading ? 'block' : 'hidden'
                } text-blue-600 dark:text-moon-gold mt-7 w-full animate-pulse text-center text-xl lg:text-2xl`}
              >
                Loading more announcements...
              </p>
            ) : (
              <button
                name="Back to the Top"
                onClick={() =>
                  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
                }
                className="mt-10 flex items-center rounded-xl border-[0.5px] border-gray-300 dark:border-gray-100 bg-gradient-to-br from-zinc-100 to-gray-200 px-2 py-1 lg:px-3 shadow-sm font-mono font-semibold hover:scale-105 dark:from-slate-950 dark:to-gray-950 dark:text-gray-100 shadow-blue-400 dark:shadow-indigo-100 lg:text-lg 2xl:text-xl"
              >
                Back to the top →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
