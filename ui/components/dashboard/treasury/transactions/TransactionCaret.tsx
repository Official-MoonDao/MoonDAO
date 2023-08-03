const TransactionCaret = ({ left, page, setPage, pageMax, isLoaded }: any) => {
  return (
    <button
      name={left ? 'Go to previous page' : 'Go to next page'}
      disabled={(left && page === 1) || page === pageMax || isLoaded}
      onClick={() => {
        left && page !== 1
          ? setPage(page - 1)
          : page !== pageMax && setPage(page + 1)
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
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export default TransactionCaret
