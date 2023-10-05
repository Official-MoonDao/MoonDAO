import React, { useEffect, useState } from 'react'
import ReactPaginate from 'react-paginate'

function Box({ text }: any) {
  return (
    <div className="justify-left flex w-1/2 items-center">
      <h4 className="text-[slategrey] px-1">{text}</h4>
    </div>
  )
}

function Holders({ currentItems }: any) {
  return (
    <div className="relative flex items-center h-full min-w-[300px] lg:min-w-[500px] flex-col gap-1 font-Montserrat text-[1vh] leading-10 text-slate-800 lg:text-[1.0vw]">
      <div className="flex w-[300px] md:w-full justify-evenly bg-gradient-to-r from-blue-800 to-blue-950 bg-clip-text text-transparent gap-1 dark:from-yellow-200 dark:to-moon-gold">
        <div className="flex justify-start w-full">
          <p className="w-1/4">ADDRESS</p>
          <p className="w-2/5">LOCKED MOONEY</p>
          <p className="w-2/5">VOTING POWER</p>
        </div>
      </div>
      {currentItems &&
        currentItems.map((item: any) => (
          <div
            className="justify-left component-background flex w-full items-center gap-[0%] rounded-2xl border-2 px-2 hover:scale-x-[1.05] transition-all duration-150 divide-x-2"
            key={item.id}
            onClick={() =>
              window.open(`https://etherscan.io/address/${item.address}`)
            }
          >
            <h4 className="w-1/3 text-blue-600 dark:text-moon-gold">
              {item.id}
            </h4>
            <div className="flex w-full gap-1 divide-x-2 divide-[#ffffff25]">
              <Box text={Number(item.totalLocked).toLocaleString()} />
              <Box
                text={Number(item.totalvMooney).toFixed(2).toLocaleString()}
              />
            </div>
          </div>
        ))}
    </div>
  )
}

function HoldersList({ data, itemsPerPage = 10 }: any) {
  const [currentItems, setCurrentItems] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  // Here we use item offsets; we could also use page offsets
  // following the API or data you're working with.
  const [itemOffset, setItemOffset] = useState(0)

  useEffect(() => {
    // Fetch items from another resources.
    const endOffset = itemOffset + itemsPerPage

    //console.log(`Loading items from ${itemOffset} to ${endOffset}`);

    setCurrentItems(data.slice(itemOffset, endOffset))
    setPageCount(Math.ceil(data.length / itemsPerPage))
  }, [itemOffset, itemsPerPage])
  const handlePageClick = (event: any) => {
    const newOffset = (event.selected * itemsPerPage) % data.length
    setItemOffset(newOffset)
  }

  return (
    <div className="flex h-[80%] w-[330px] sm:[330px] md:w-full flex-col items-center justify-center">
      <Holders currentItems={currentItems} />
      <ReactPaginate
        breakLabel=""
        breakClassName="absolute hidden w-0"
        nextLabel=">"
        nextClassName="relative bottom-4 flex justify-center"
        nextLinkClassName="absolute flex w-[15vw] items-center justify-center rounded-full bg-[skyblue] dark:bg-[orange] lg:h-[2vw] lg:w-[5vw]"
        onPageChange={handlePageClick}
        pageLinkClassName="absolute hidden w-0 z[-10]"
        pageRangeDisplayed={100}
        pageCount={pageCount}
        previousLabel="<"
        previousClassName="relative bottom-4 flex justify-center"
        previousLinkClassName="absolute flex w-[15vw] items-center justify-center rounded-full bg-[skyblue] dark:bg-[orange] lg:h-[2vw] lg:w-[5vw]"
        renderOnZeroPageCount={null}
        containerClassName={
          'h-[8vh] relative my-8 flex justify-center space-x-1 lg:space-x-2 items-center text-center w-full select-none'
        }
      />
    </div>
  )
}

export default HoldersList
