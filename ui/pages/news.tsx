import Head from '../components/layout/Head'

export default function News() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn lg:px-3 lg:pb-14 lg:mt-1 md:max-w-[1080px]">
      <Head
        title="News"
        description="Stay informed with the latest news and updates from MoonDAO"
      />
      <iframe
        className="absolute top-0 left-0 h-[110vh] overflow-auto w-full"
        src="https://moondao.ck.page/profile/posts"
        allowFullScreen
      />
    </div>
  )
}
