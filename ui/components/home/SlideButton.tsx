export default function SlideButton({
  className = '',
  children,
  onClick = () => {},
}: any) {
  return (
    <button className={`slidebtn ${className}`} onClick={onClick || null}>
      <div className="px-4 font-GoodTimes">{children}</div>
    </button>
  )
}
