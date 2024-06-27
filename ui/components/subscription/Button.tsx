export default function Button({
  children,
  onClick,
  className = '',
  type = 'button',
}: any) {
  return (
    <button
      className={`px-5 pt-2 pb-3${className}`}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}
