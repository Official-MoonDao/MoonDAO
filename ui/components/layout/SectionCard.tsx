type SectionCardProps = {
  id?: string
  className?: string
  children: React.ReactNode
}

export default function SectionCard({
  id,
  className = '',
  children,
}: SectionCardProps) {
  return (
    <div
      id={id}
      className={`mt-3 px-5 lg:px-10 xl:px-10 py-5 bg-[#020617] rounded-2xl w-full lg:mt-10 lg:w-full lg:max-w-[1080px] flex flex-col ${className}`}
    >
      {children}
    </div>
  )
}
