import Header from '../../layout/Header'

const AnalyticsSkeleton = () => {
  return (
    <div className="mt-8 md:ml-14 lg:mt-12">
      <div className="flex flex-col items-center lg:items-start mt-4 lg:ml-14">
        <div className="loading-component mt-6 flex  w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1380px]   min-h-[60vh] animate-pulse"></div>
        <div className="loading-component mt-6 flex  w-[336px] sm:w-[400px] lg:w-full lg:max-w-[1380px]   min-h-[60vh] animate-pulse"></div>
      </div>
    </div>
  )
}

export default AnalyticsSkeleton
