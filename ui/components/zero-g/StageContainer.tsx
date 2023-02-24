export default function StageContainer({ children, opacity75 }: any) {
  return (
    <div
      className={
        opacity75
          ? 'flex flex-col justify-center items-left animate-fadeInSlowTo75 gap-6'
          : 'flex flex-col justify-center items-left animate-fadeInSlow gap-6'
      }
    >
      {children}
    </div>
  )
}
