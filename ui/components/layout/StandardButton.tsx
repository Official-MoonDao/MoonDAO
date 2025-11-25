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
  backgroundColor = 'bg-gradient-to-r from-blue-600 to-purple-600',
  hoverColor = 'hover:from-blue-700 hover:to-purple-700',
  hoverEffect = false, // Disabled by default to remove extension effect
  borderRadius = 'rounded-lg',
  link = '#',
  target = '',
  paddingOnHover = '',
  textColor = 'text-white',
  styleOnly = false,
  type = 'button',
}: StandardButtonProps) {
  // Check if className already contains a gradient to avoid conflicts
  const hasCustomGradient = className.includes('bg-gradient')
  const effectiveBackgroundColor = hasCustomGradient ? '' : backgroundColor
  const effectiveHoverColor = hasCustomGradient ? '' : hoverColor

  const buttonContent = (
    <button
      id={id}
      className={`
        px-4 py-2 font-medium transition-all duration-200 shadow-lg hover:shadow-xl
        ${effectiveBackgroundColor} 
        ${effectiveHoverColor}
        ${borderRadius} 
        ${textColor}
        ${className}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
  ) : (
    <Link href={link} target={target} rel="noopener noreferrer">
      {buttonContent}
    </Link>
  )
}
