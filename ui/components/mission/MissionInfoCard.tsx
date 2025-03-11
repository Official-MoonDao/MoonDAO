export default function MissionInfoCard({
  children,
  className,
  title,
}: {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <div className={`bg-cool p-4 rounded-lg ${className}`}>
      {title && <h1 className="">{title}</h1>}
      <p className="text-lg">{children}</p>
    </div>
  )
}
