export default function IndexCardGridContainer({ children, className = '' }: any) {
    return (
      <div
        id="index-card-grid-container"
        className={`h-full w-full mb-10 grid grid-cols-1 min-[1100px]:grid-cols-2 min-[1450px]:grid-cols-3 mt-5 gap-5 items-start ${className}`}
      >
        {children}
      </div>
    )
  }
  