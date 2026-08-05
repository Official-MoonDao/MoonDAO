import { GetServerSideProps } from 'next'

export default function OverviewVote() {
  // This page is replaced by a server-side redirect and should never render.
  return null
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: 'https://www.moondao.com/mission/4?tab=leaderboard',
      permanent: true,
    },
  }
}
