export default function CardSkeleton() {
  return (
    <span
      id="link-frame"
      className={`
              card-container min-w-[300px] w-[65vw] md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
        
          `}
    >
      <span
        id="card-container"
        className="animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[520px] animate-pulse"
      ></span>
    </span>
  )
}
