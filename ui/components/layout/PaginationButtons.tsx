import Image from 'next/image'
import Frame from '@/components/layout/Frame'

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
    <Frame noPadding marginBottom="0px">
      <div
        id="pagination-container"
        className="w-full mb-5 flex font-GoodTimes text-2xl flex-row justify-center items-center lg:space-x-8 px-4"
      >
        <button
          onClick={() => {
            if (pageIdx > 1) {
              handlePageChange(pageIdx - 1)
            }
          }}
          className={`pagination-button transition-opacity hover:scale-110 flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full ${
            pageIdx === 1 ? 'opacity-10' : 'cursor-pointer opacity-100'
          }`}
          disabled={pageIdx === 1}
        >
          <Image
            src="/../.././assets/icon-left.svg"
            alt="Left Arrow"
            width={35}
            height={35}
          />
        </button>
        <p id="page-number" className="px-5 font-bold whitespace-nowrap">
          {label || 'Page'} {pageIdx} of {maxPage}
        </p>
        <button
          onClick={() => {
            if (pageIdx < maxPage) {
              handlePageChange(pageIdx + 1)
            }
          }}
          className={`pagination-button transition-opacity hover:scale-110 flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full ${
            pageIdx === maxPage ? 'opacity-10' : 'cursor-pointer opacity-100'
          }`}
          disabled={pageIdx === maxPage}
        >
          <Image
            src="/../.././assets/icon-right.svg"
            alt="Right Arrow"
            width={35}
            height={35}
          />
        </button>
      </div>
    </Frame>
  )
}
