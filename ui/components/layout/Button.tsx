import Link from 'next/link'
import { ReactNode } from 'react'
import { buttonStyles } from '@/lib/layout/styles'
import { ButtonVariant, ButtonSize, buttonSizes } from '@/lib/layout/variants'

export interface ButtonProps {
  id?: string
  variant?: ButtonVariant | 'right' | 'share' | 'pagination'
  size?: ButtonSize
  className?: string
  children?: ReactNode
  onClick?: any
  disabled?: boolean
  borderRadius?: string
  link?: string
  target?: string
  paddingOnHover?: string
  textColor?: string
  styleOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  hoverEffect?: boolean
}

export default function Button({
  id,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  disabled = false,
  borderRadius,
  link = '#',
  target = '',
  paddingOnHover = '',
  textColor = 'text-white',
  styleOnly = false,
  type = 'button',
  icon,
  iconPosition = 'left',
  hoverEffect = false,
  ...props
}: ButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
      case 'gradient':
        return buttonStyles.primary
      case 'secondary':
        return buttonStyles.secondary
      case 'right':
        return 'dark-cool hover:mid-cool'
      case 'share':
      case 'pagination':
        return buttonStyles.secondary
      default:
        return buttonStyles.primary
    }
  }

  const getSizeStyles = () => buttonSizes[size] || buttonSizes.md

  const hasCustomBackground = className.includes('bg-') || className.includes('gradient')
  const baseStyles = `
    font-medium transition-all duration-200 shadow-lg hover:shadow-xl
    ${hasCustomBackground ? '' : getVariantStyles()}
    ${getSizeStyles()}
    ${borderRadius || 'rounded-lg'}
    ${textColor}
    ${className}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `

  const buttonContent = (
    <button
      id={id}
      className={baseStyles}
      onClick={onClick || null}
      type={type}
      disabled={disabled}
      {...props}
    >
      {variant === 'right' ? (
        <div
          id="button-content"
          className={`py-3 px-5 rounded-[2vmax] rounded-tr-[10px] ${textColor}`}
        >
          {icon && iconPosition === 'left' && <span className="mr-2">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="ml-2">{icon}</span>}
        </div>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="mr-2">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="ml-2">{icon}</span>}
        </>
      )}
    </button>
  )

  return styleOnly ? (
    buttonContent
  ) : link && link !== '#' ? (
    <Link href={link} target={target} rel="noopener noreferrer">
      {buttonContent}
    </Link>
  ) : (
    buttonContent
  )
}
