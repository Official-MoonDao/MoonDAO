import Announcement from './Announcement'

const AnnouncementSkeletons = () => {
  const skeletonData = {
    content: Array(8)
      .fill('Loading, if this takes too long contact MoonDao Discord ')
      .join(' '),
    mentions: [],
    author: { username: 'MoonDAO' },
    timestamp: new Date(),
    reactions: [
      { emoji: { name: '🚀' }, count: '10' },
      { emoji: { name: '🚀' }, count: '10' },
      { emoji: { name: '🚀' }, count: '10' },
    ],
  }

  return (
    <>
      {Array(10)
        .fill(skeletonData)
        .map((e, i) => (
          <Announcement
            loading
            key={'announcement-skeleton' + i}
            content={e.content}
            mentions={e.mentions}
            author={e.author}
            timestamp={e.timestamp}
            reactions={e.reactions}
          />
        ))}
    </>
  )
}

export default AnnouncementSkeletons
