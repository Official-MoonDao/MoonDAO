import Link from 'next/link'

type StandardButtonProps = {
  id?: string
  className?: string
  children?: React.ReactNode
  onClick?: any
  disabled?: boolean
  backgroundColor?: string
  hoverColor?: string
  hoverEffect?: boolean
  borderRadius?: string
  link?: string
  target?: string
  paddingOnHover?: string
  textColor?: string
  styleOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export default function StandardButton({
  id,
  className = '',
  children = 'ReactNode',
  onClick = () => {},
  disabled = false,
  backgroundColor = 'dark-cool',
  hoverColor = 'mid-cool',
  hoverEffect = true,
  borderRadius = 'rounded',
  link = '#',
  target = '',
  paddingOnHover = 'pl-5',
  textColor = 'text-white',
  styleOnly = false,
  type = 'button',
}: StandardButtonProps) {
  const buttonContent = (
    <button
      id={id}
      className={`
        standardbutton transition-all duration-200       
        ${backgroundColor} 
        ${borderRadius} 
        ${className} 
      `}
      onClick={onClick || null}
      style={{ paddingLeft: '0' }}
      onMouseEnter={(e) =>
        hoverEffect && (e.currentTarget.style.paddingLeft = '10px')
      }
      onMouseLeave={(e) =>
        hoverEffect && (e.currentTarget.style.paddingLeft = '0')
      }
      type={type as any}
      disabled={disabled}
    >
      <div
        id="button-content"
        className={` 
          p-2 pb-2 pr-5 pl-5 
          ${textColor}
        `}
      >
        {children}
      </div>
    </button>
  )

  return styleOnly ? (
    buttonContent
  ) : (
    <Link href={link} target={target} rel="noopener noreferrer">
      {buttonContent}
    </Link>
  )
}
