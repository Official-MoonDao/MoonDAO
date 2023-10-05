interface PaginationButton {
  page: number
  skip: number
  setSkip: Function
  scrollUp: boolean
}

const PaginationButton = ({
  page,
  skip,
  setSkip,
  scrollUp,
}: PaginationButton) => {
  const samePageClick = page * 10 === skip
  return (
    <button
      name={`Go to page ${page}`}
      disabled={samePageClick}
      className={` h-[35px] w-[35px] border border-blue-600 rounded-md text-center text-xl font-semibold hover:scale-105 dark:border-indigo-100 ${
        skip === page * 10
          ? 'scale-125 bg-blue-600 text-white dark:bg-slate-900 dark:text-white'
          : 'bg-white text-slate-800 dark:bg-gray-100 dark:text-slate-950'
      }`}
      onClick={() => {
        setSkip(10 * page)
        if (scrollUp)
          setTimeout(
            () => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }),
            300
          )
      }}
    >
      {page + 1}
    </button>
  )
}

export default PaginationButton
