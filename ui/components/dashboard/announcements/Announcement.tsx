import Image from 'next/image'
import React from 'react'
import BlurBackground from '../../layout/BlurBackground'
import AnnouncementContent from './AnnouncementContent'
import Reaction from './Reaction'

const Announcement = React.forwardRef(
  (
    {
      content,
      mentions,
      author,
      timestamp,
      reactions,
      loading,
      attachments,
    }: any,
    ref: any
  ) => {
    const avatar = `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.webp?size=80`
    const name = author.username
    const time = new Date(timestamp).toDateString()

    const AnnouncementBody = (
      <div
        className={`relative mt-10 w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] ${
          loading && 'loading-component'
        }`}
      >
        <BlurBackground />

        <div className="component-background relative rounded-2xl border border-detail-light dark:border-detail-dark px-4 py-4 lg:px-6 lg:py-5 xl:px-10 xl:py-6">
          {/*Avatar, Name, Date */}
          <div className="flex items-center">
            {loading ? (
              <div className="loading-line h-16 w-16 rounded-full"></div>
            ) : (
              <Image
                src={avatar}
                className="h-[60px] w-auto rounded-full object-cover lg:h-[85px] lg:border lg:border-detail-light lg:border-opacity-75 lg:p-1 lg:dark:border-detail-dark"
                width={60}
                height={60}
                alt={`${name} Discord's Avatar`}
              />
            )}

            <div className="ml-6 flex flex-col lg:ml-7">
              <p
                className={`inline-block font-mono text-sm text-stronger-dark dark:text-detail-dark xl:text-base ${
                  loading && 'loading-line'
                }`}
              >
                {time}
              </p>
              <h4
                className={`mt-1 font-Montserrat capitalize tracking-wider text-xl lg:text-3xl xl:text-3xl ${
                  loading
                    ? 'loading-line'
                    : 'bg-gradient-to-r from-stronger-light to-moon-blue bg-clip-text text-transparent dark:from-stronger-dark dark:to-detail-dark'
                }`}
              >
                {name}
              </h4>
            </div>
          </div>

          {/*Content*/}
          <div className="mt-2 lg:mt-4 2xl:mt-6">
            <AnnouncementContent
              text={content}
              mentions={mentions}
              loading={loading}
            />
          </div>

          {/*Attachments*/}
          <div className="mt-2 grid gap-4 lg:mt-4 2xl:mt-6">
            {attachments &&
              attachments.map((attachment: any, i: number) => (
                <Image
                  className="h-auto max-w-[300px] lg:max-w-[400px] 2xl:max-w-[450px]"
                  key={'announcement-attachment' + i}
                  src={attachment.url}
                  width={300}
                  height={300}
                />
              ))}
          </div>

          {/*Reactions*/}
          <div className="mt-3 flex overflow-x-auto p-1">
            {reactions &&
              reactions.map((reaction: any, i: number) => (
                <Reaction
                  key={'announcement-reaction' + i}
                  reaction={reaction}
                  index={i}
                  loading={loading}
                />
              ))}
          </div>
        </div>
      </div>
    )

    const result = ref ? (
      <article ref={ref}>{AnnouncementBody}</article>
    ) : (
      <article>{AnnouncementBody}</article>
    )

    return result
  }
)
Announcement.displayName = 'Announcement'
export default Announcement
