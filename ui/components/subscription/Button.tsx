export default function Button({
  children,
  onClick,
  className = '',
  type = 'button',
}: any) {
  return (
    <button
      className={`px-5 py-2 ${className}`}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}
