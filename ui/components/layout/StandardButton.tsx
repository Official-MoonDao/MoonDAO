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
  const hasCustomGradient = className.includes('bg-gradient') || className.includes('gradient-')

  // Always keep fallback background, even when custom gradient is present
  const effectiveBackgroundColor = backgroundColor
  const effectiveHoverColor = hoverColor

  // Determine if we should wrap in Link
  const shouldWrapInLink = !styleOnly && link !== '#'

  // This ensures backgrounds render even if CSS classes fail
  const inlineStyle: React.CSSProperties = {}

  // If custom gradient is detected, add fallback inline background
  // This provides a safety net if the gradient class doesn't apply
  if (hasCustomGradient) {
    if (className.includes('gradient-2')) {
      inlineStyle.background = 'linear-gradient(90deg, #425eeb 5%, #6d3f79 90%)'
    } else if (className.includes('from-[#6C407D]')) {
      inlineStyle.background = 'linear-gradient(to right, #6C407D, #5F4BA2, #4660E7)'
    } else {
      inlineStyle.background = 'linear-gradient(to right, #2563eb, #9333ea)'
    }
  } else {
    inlineStyle.background = 'linear-gradient(to right, #2563eb, #9333ea)'
  }

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
      style={inlineStyle}
      onClick={onClick || null}
      type={type as any}
      disabled={disabled}
    >
      {children}
    </button>
  )

  if (styleOnly || !shouldWrapInLink) {
    return buttonContent
  }

  return (
    <Link href={link} target={target} rel="noopener noreferrer">
      {buttonContent}
    </Link>
  )
}
