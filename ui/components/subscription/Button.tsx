export default function Button({
  children,
  onClick,
  className = '',
  type = 'button',
}: any) {
  return (
    <button
      className={`w-[200px] h-[50px] px-4 py-2 text-moon-orange border-moon-orange border-[1px] flex items-center gap-2 hover:scale-105 duration-300 ${className}`}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}
