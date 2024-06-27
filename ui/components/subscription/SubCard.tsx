export default function SubCard({ children, className = '', onClick }: any) {
  return (
    <div
      className={`p-8 md:p-5 rounded-[20px] bg-dark-cool text-start ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
