const TransactionPagination = ({ currentPage, pageNumber, setPage, isLoaded }: any) => {
  const samePage = currentPage === pageNumber;
  return (
    <button
      disabled={samePage || isLoaded}
      name={`Go to page ${pageNumber}`}
      className={` h-[35px] w-[35px] border rounded-md text-center text-xl font-semibold hover:scale-105 ${
        samePage ? "scale-125 bg-[rgba(0,255,200,0.15)] text-[#00ffc8] border-[#00ffc8]" : "bg-[rgba(0,255,200,0.04)] text-[#b0ffe0] border-[rgba(0,255,200,0.2)] hover:bg-[rgba(0,255,200,0.08)]"
      }`}
      onClick={() => {
        setPage(pageNumber);
      }}
    >
      {pageNumber}
    </button>
  );
};

export default TransactionPagination;
