interface CaretButton {
  left: boolean
  skip: number
  setSkip: Function
  total: number
  scrollUp: boolean
}

const CaretButton = ({ left, skip, setSkip, total, scrollUp }: CaretButton) => {
  const canGoToLeftPage = left && skip - 10 >= 0
  const canGoToRightPage = skip + 10 <= total

  return (
    <button
      name={left ? 'Go to previous page' : 'Go to next page'}
      disabled={
        (left && !canGoToLeftPage) || (!canGoToRightPage && !canGoToLeftPage)
      }
      onClick={() => {
        if ((scrollUp && canGoToRightPage) || (scrollUp && canGoToLeftPage))
          setTimeout(
            () => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }),
            300
          )
        left && canGoToLeftPage
          ? setSkip(skip - 10)
          : canGoToRightPage && setSkip(skip + 10)
      }}
      className="border-[50%] margin-auto block h-[36px] w-[36px] rounded-full border border-blue-600 dark:bg-slate-950 disabled:border-blue-400 disabled:opacity-50 bg-slate-50 disabled:hover:scale-100 dark:border-white"
    >
      <svg
        width={8}
        height={12}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative ${
          left ? 'right-[1px] rotate-180' : 'left-[1px]'
        } bottom-[1.5px]  inline`}
      >
        <path
          className="stroke-blue-500  dark:stroke-white"
          d="m1.333 1 5 5-5 5"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export default CaretButton
