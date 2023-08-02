import {
  discordChannelDictionary,
  discordRoleDictionary,
} from '../../../lib/dashboard/dashboard-utils.ts/discord-config'
import { parseAnnouncementText } from '../../../lib/dashboard/dashboard-utils.ts/parseAnnouncementText'
import { LogoSmall } from '../../assets'

const AnnouncementContent = ({ text, mentions, loading }: any) => {
  const linkRegex =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g
  const textSeparatedFromLinks = parseAnnouncementText(text, linkRegex)

  return (
    <p
      className={`whitespace-pre-wrap break-words font-mono leading-relaxed text-light-text dark:text-dark-text lg:text-lg 2xl:text-xl ${
        loading && 'loading-line'
      }`}
    >
      {textSeparatedFromLinks.map((str, i) =>
        i % 2 === 0 ? (
          <TextContent key={i} sentence={str} mentions={mentions} />
        ) : (
          <a
            key={i}
            className="link "
            href={str}
            target="_blank"
            rel="noreferrer"
          >{`${str} `}</a>
        )
      )}
    </p>
  )
}

const TextContent = ({ sentence, mentions }: any) => {
  const mentionsRegex = /<(@|#).[0-9]*>/g
  const sentenceSeparatedFromMentions = parseAnnouncementText(
    sentence,
    mentionsRegex
  )
  // Added a way to add the MoonDAO shield emoticon by detecting the id
  return (
    <>
      {sentenceSeparatedFromMentions.map((e, i) =>
        e.startsWith('<@&') ? (
          <ReplaceIdWithRoleName key={i} word={e} />
        ) : e.startsWith('<#') ? (
          <ReplaceIdWithChannelName key={i} word={e} />
        ) : e.startsWith('<@') ? (
          <ReplaceIdWithMention key={i} word={e} mentions={mentions} />
        ) : e.includes('<:MoonDAO:1047902000601383013>') ? (
          <>
            {e.slice(0, e.indexOf('<:MoonDAO:1047902000601383013>'))}{' '}
            <LogoSmall size={{ height: 28, width: 28 }} />
            {e.slice(e.indexOf('<:MoonDAO:1047902000601383013>') + 30)}
          </>
        ) : (
          e
        )
      )}
    </>
  )
}

const ReplaceIdWithRoleName = ({ word }: any) => {
  const ending = word.lastIndexOf('>')
  const roleId = word.slice(3, ending)
  return (
    <>
      {discordRoleDictionary[roleId] ? (
        <span
          className={` ${discordRoleDictionary[roleId][0]} `}
        >{`@${discordRoleDictionary[roleId][1]}`}</span>
      ) : (
        word
      )}
    </>
  )
}

const ReplaceIdWithChannelName = ({ word }: any) => {
  const ending = word.lastIndexOf('>')
  const channelId = word.slice(2, ending)

  return (
    <>
      {discordChannelDictionary[channelId] ? (
        <>
        <span
          className={`${discordChannelDictionary[channelId][0]}`}
          >{`@${discordChannelDictionary[channelId][1]}`}</span>
          </>
      ) : (
        word
      )}
    </>
  )
}

const ReplaceIdWithMention = ({ word, mentions }: any) => {
  const ending = word.lastIndexOf('>')
  const id = word.slice(2, ending)

  return (
    <>
      {mentions.map(
        (mention: any, i: number) =>
          mention.id.includes(id) && (
            <span
              key={i}
              className="font-semibold text-moon-blue dark:text-stronger-dark"
            >{`@${mention.username}`}</span>
          )
      )}
    </>
  )
}

export default AnnouncementContent
