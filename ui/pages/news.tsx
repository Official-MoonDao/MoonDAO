import { GetStaticProps } from 'next'
import { FEED_REVALIDATE_SECONDS, loadFeedProps } from '@/lib/updates/loadFeed'
import type { FeedProps } from '@/lib/updates/loadFeed'
import UpdatesFeedPage from '@/components/updates/UpdatesFeedPage'

export default function News(props: FeedProps) {
  return <UpdatesFeedPage {...props} variant="news" />
}

export const getStaticProps: GetStaticProps<FeedProps> = async () => ({
  props: await loadFeedProps(),
  revalidate: FEED_REVALIDATE_SECONDS,
})
