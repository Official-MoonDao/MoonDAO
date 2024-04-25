export default function Card({ children, className = '', onClick }: any) {
  return (
    <div
      className={`p-8 md:p-4 rounded-md dark:bg-[#080C20] border-2 dark:border-0 text-start text-black dark:text-white ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
