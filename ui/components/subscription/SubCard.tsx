export default function SubCard({ children, className = '', onClick }: any) {
  return (
    <div
      className={`p-8 md:p-4 rounded-md bg-[#0f152f] border-2 dark:border-0 text-start text-black dark:text-white ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
