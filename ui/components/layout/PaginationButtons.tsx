import Image from 'next/image'

type PaginationButtonsProps = {
  handlePageChange: (newPage: number) => void
  maxPage: number
  pageIdx: number
  label?: string
}

export default function PaginationButtons({
  handlePageChange,
  maxPage,
  pageIdx,
  label,
}: PaginationButtonsProps) {
  return (
    <div
      id="pagination-container"
      className="w-full mb-5 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6"
    >
      <div className="flex font-GoodTimes text-xl md:text-2xl flex-row justify-center items-center gap-4 md:gap-8">
        <button
          onClick={() => {
            if (pageIdx > 1) {
              handlePageChange(pageIdx - 1)
            }
          }}
          className={`
            flex-shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl
            transition-all duration-200 shadow-lg
            ${
              pageIdx === 1
                ? 'bg-gradient-to-b from-slate-700/20 to-slate-800/30 opacity-50 cursor-not-allowed'
                : 'gradient-2 cursor-pointer opacity-100 hover:scale-110 hover:shadow-xl'
            }
          `}
          disabled={pageIdx === 1}
          aria-label="Previous page"
        >
          <Image
            src="/../.././assets/icon-left.svg"
            alt="Left Arrow"
            width={24}
            height={24}
            className="w-6 h-6"
          />
        </button>
        <div
          id="page-number"
          className="px-4 md:px-6 py-2 bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-sm border border-white/10 rounded-xl font-bold text-white whitespace-nowrap"
        >
          {label || 'Page'} {pageIdx} of {maxPage}
        </div>
        <button
          onClick={() => {
            if (pageIdx < maxPage) {
              handlePageChange(pageIdx + 1)
            }
          }}
          className={`
            flex-shrink-0 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl
            transition-all duration-200 shadow-lg
            ${
              pageIdx === maxPage
                ? 'bg-gradient-to-b from-slate-700/20 to-slate-800/30 opacity-50 cursor-not-allowed'
                : 'gradient-2 cursor-pointer opacity-100 hover:scale-110 hover:shadow-xl'
            }
          `}
          disabled={pageIdx === maxPage}
          aria-label="Next page"
        >
          <Image
            src="/../.././assets/icon-right.svg"
            alt="Right Arrow"
            width={24}
            height={24}
            className="w-6 h-6"
          />
        </button>
      </div>
    </div>
  )
}
