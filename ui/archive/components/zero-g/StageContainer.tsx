export default function StageContainer({ children, opacity75 }: any) {
  return (
    <div
      className={
        opacity75
          ? 'flex flex-col justify-center items-center w-full animate-fadeInSlowTo75 gap-[2%]'
          : 'flex flex-col justify-center items-center w-full animate-fadeInSlow gap-1'
      }
    >
      {children}
    </div>
  )
}
