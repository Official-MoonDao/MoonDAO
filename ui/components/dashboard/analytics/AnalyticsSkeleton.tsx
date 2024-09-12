import Header from '../../layout/Header'

const AnalyticsSkeleton = () => {
  return (
    <div className="grid gap-4 lg:gap-0 xl:grid-cols-1 mt-2 md:pl-16 lg:mt-10 lg:w-full lg:max-w-[1380px] items-center justify-center">
      <section className="mt-3 px-5 lg:px-10 xl:px-10 py-6 xl:pt-16 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] flex flex-col items-center loading-component h-[700px] lg:h-[750px] animate-pulse"></section>
      <section className="mt-3 px-5 lg:px-10 xl:px-10 py-6 xl:pt-16 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] flex flex-col items-center loading-component h-[700px] lg:h-[750px] animate-pulse"></section>
    </div>
  )
}

export default AnalyticsSkeleton
