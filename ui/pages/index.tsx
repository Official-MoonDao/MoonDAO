import { HOME_TOUR_ENABLED } from 'const/flags'
import getHomeStaticProps from '@/lib/home/getHomeStaticProps'
import LegacyHome from '@/components/home/LegacyHome'
import HomeTour from '@/components/home/tour/HomeTour'

export default function Home(props: any) {
  return HOME_TOUR_ENABLED ? <HomeTour {...props} /> : <LegacyHome {...props} />
}

export const getStaticProps = getHomeStaticProps
