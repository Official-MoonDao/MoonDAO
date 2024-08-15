import { LoadingSpinner } from '../layout/LoadingSpinner'

type StepLoadingProps = {
  stepNum: number
  title: string
  explanation: string
}

export function StepLoading({ stepNum, title, explanation }: StepLoadingProps) {
  return (
    <div className="mt-5 w-full h-full text-black dark:text-white">
      <div className="flex flex-col text-left lg:flex-row lg:text-left lg:gap-5 lg:w-full lg:h-full p-4 lg:p-6 border border-gray-500 dark:border-white dark:border-opacity-[0.18] animate-pulse">
        <p className="block px-3 py-1 w-10 h-10 flex justify-center items-center text-xl font-bold rounded-[9999px] bg-[grey]">
          {stepNum}
        </p>
        <div className="flex-col justify-start items-start gap-4 inline-flex">
          <div className="mt-[15px] text-left block lg:mt-0 xl:text-xl w-[150px]">
            {title}
          </div>
        </div>
        <div className="mt-1 opacity-60 text-base font-normal lg:mt-0 xl:text-base w-full font-[Lato]">
          {explanation}
        </div>
        <LoadingSpinner />
      </div>
    </div>
  )
}
