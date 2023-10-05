const TransactionPagination = ({ currentPage, pageNumber, setPage, isLoaded }: any) => {
  const samePage = currentPage === pageNumber;
  return (
    <button
      disabled={samePage || isLoaded}
      name={`Go to page ${pageNumber}`}
      className={` h-[35px] w-[35px] border border-blue-600 rounded-md text-center text-xl font-semibold hover:scale-105 dark:border-indigo-100  ${
        samePage ? "scale-125 bg-blue-600 text-white dark:bg-slate-900 dark:text-white" : "bg-white text-slate-800 dark:bg-gray-100 dark:text-slate-950"
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
