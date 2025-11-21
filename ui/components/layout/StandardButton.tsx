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
  backgroundColor,
  hoverColor,
  hoverEffect = false,
  borderRadius = 'rounded-lg',
  link = '#',
  target = '',
  paddingOnHover = '',
  textColor = 'text-white',
  styleOnly = false,
  type = 'button',
}: StandardButtonProps) {
  const defaultBackground = 'bg-gradient-to-r from-blue-600 to-purple-600'
  const defaultHover = 'hover:from-blue-700 hover:to-purple-700'
  const finalBackground =
    backgroundColor !== undefined && backgroundColor !== '' ? backgroundColor : defaultBackground

  // Handle hoverColor - add hover: prefix if not already present
  let finalHover = ''
  if (hoverColor) {
    finalHover = hoverColor.startsWith('hover:') ? hoverColor : `hover:${hoverColor}`
  } else if (!backgroundColor) {
    finalHover = defaultHover
  }

  const buttonContent = (
    <button
      id={id}
      className={`
        px-4 py-2 font-medium transition-all duration-200 shadow-lg hover:shadow-xl
        ${finalBackground}
        ${finalHover}
        ${borderRadius}
        ${textColor}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={onClick || null}
      type={type as any}
      disabled={disabled}
    >
      {children}
    </button>
  )

  return styleOnly ? (
    buttonContent
  ) : link && link !== '#' ? (
    <Link href={link} target={target} rel="noopener noreferrer" className="inline-block">
      {buttonContent}
    </Link>
  ) : (
    buttonContent
  )
}
