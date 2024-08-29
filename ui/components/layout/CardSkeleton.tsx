export default function CardSkeleton() {
  return (
    <span
      id="link-frame"
      className={`
              card-container  md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
        
          `}
    >
      <span
        id="card-container"
        className="animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full min-h-[520px] animate-pulse"
      ></span>
    </span>
  )
}
