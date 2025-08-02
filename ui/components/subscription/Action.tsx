import SubCard from './SubCard'

type ActionProps = {
  title: string
  description: string | React.ReactNode
  icon: any
  onClick?: () => void
  disabled?: boolean
}

export default function Action({
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: ActionProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={disabled ? 'opacity-50 cursor-not-allowed' : ''}
    >
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
