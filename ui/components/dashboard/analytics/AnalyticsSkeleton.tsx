import Header from '../../layout/Header'

const AnalyticsSkeleton = () => {
  return (
    <div>
      <div className="flex flex-col items-start xl:max-w-[800px] 2xl:max-w-[1080px]">
        <Header text={'Analytics'} />
        {/* <Line */}
      </div>
      <div className="flex flex-col items-center lg:items-start mt-4">
        <div className="loading-component mt-6 flex w-[336px] sm:w-[400px] lg:w-[650px] xl:w-[800px] 2xl:w-[1080px]  min-h-[85vh] 2xl:max-w-[1080px] animate-pulse"></div>
        <div className="loading-component mt-6 flex w-[336px] sm:w-[400px] lg:w-[650px] xl:w-[800px] 2xl:w-[1080px]  min-h-[85vh] 2xl:max-w-[1080px] animate-pulse"></div>
        <div className="loading-component mt-6 flex w-[336px] sm:w-[400px] lg:w-[650px] xl:w-[800px] 2xl:w-[1080px]  min-h-[85vh] 2xl:max-w-[1080px] animate-pulse"></div>
      </div>
    </div>
  )
}

export default AnalyticsSkeleton
