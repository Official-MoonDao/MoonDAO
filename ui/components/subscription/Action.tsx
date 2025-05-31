import SubCard from './SubCard'

type ActionProps = {
  title: string
  description: string
  icon: any
  onClick?: () => void
}

export default function Action({
  title,
  description,
  icon,
  onClick,
}: ActionProps) {
  return (
    <button onClick={onClick}>
      <SubCard className="flex flex-col gap-2 ease-in-out duration-300 w-[275px] h-[225px] border-[1px] border-transparent hover:border-white">
        <div className="flex gap-2">
          {icon}
          <p className="pb-2 font-bold text-xl">{title}</p>
        </div>
        <p className="pb-5">{description}</p>
      </SubCard>
    </button>
  )
}
