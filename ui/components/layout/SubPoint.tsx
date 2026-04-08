export default function SubPoint({
  point,
  className = '',
}: {
  point: string
  className?: string
}) {
  return (
    <div className={`ml-4 mb-2 ${className}`.trim()}>
      <span className="font-bold">●</span> {point}
    </div>
  )
}
