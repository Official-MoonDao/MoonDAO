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
  backgroundColor = 'bg-gradient-to-r from-[#00aa88] to-[#007a66]',
  hoverColor = 'hover:from-[#00cc99] hover:to-[#00aa88]',
  hoverEffect = false, // Disabled by default to remove extension effect
  borderRadius = 'rounded-sm',
  link = '#',
  target = '',
  paddingOnHover = '',
  textColor = 'text-white',
  styleOnly = false,
  type = 'button',
}: StandardButtonProps) {
  const buttonStyles = `
    px-4 py-2 font-medium transition-all duration-200 shadow-lg hover:shadow-xl
    ${backgroundColor} 
    ${hoverColor}
    ${borderRadius} 
    ${textColor}
    ${className}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `

  // Use span instead of button when wrapped in Link - nesting <button> inside <a> is invalid HTML
  // and can prevent navigation from working (clicks don't reach the link)
  if (!styleOnly && link && link !== '#') {
    return (
      <Link
        href={link}
        target={target}
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center ${buttonStyles}`}
        onClick={onClick}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      id={id}
      className={buttonStyles}
      onClick={onClick || undefined}
      type={type as any}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
