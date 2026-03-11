//StandardButtonRight.tsx
import Link from 'next/link'
import React from 'react'

type StandardButtonRightProps = {
  className?: string
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  backgroundColor?: string
  hoverColor?: string
  borderRadius?: string
  link?: string
  paddingOnHover?: string
  textColor?: string
  styleOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export default function StandardButtonRight({
  className = '',
  children = 'ReactNode',
  onClick = () => {},
  disabled = false,
  backgroundColor = 'dark-cool',
  hoverColor = 'mid-cool',
  borderRadius = 'rounded',
  link = '#',
  paddingOnHover = 'pl-5',
  textColor = 'text-white',
  styleOnly = false,
  type = 'button',
}: StandardButtonRightProps) {
  const buttonContent = (
    <div
      id="button-content"
      className={` 
        py-3 px-5 rounded-[2vmax] rounded-tr-[10px]
        ${textColor}
      `}
    >
      {children}
    </div>
  )

  const buttonStyles = `
    standardbutton transition-all duration-200       
    ${backgroundColor} 
    ${borderRadius} 
    ${className} 
  `

  // Use Link with span when we have a real link - nesting <button> inside <a> prevents navigation
  if (!styleOnly && link && link !== '#') {
    return (
      <Link
        href={link}
        className={`inline-block ${buttonStyles}`}
        style={{ paddingRight: '0' }}
        onMouseEnter={(e) => (e.currentTarget.style.paddingRight = '10px')}
        onMouseLeave={(e) => (e.currentTarget.style.paddingRight = '0')}
        onClick={onClick}
      >
        {buttonContent}
      </Link>
    )
  }

  return (
    <button
      className={buttonStyles}
      onClick={onClick || undefined}
      style={{ paddingRight: '0' }}
      onMouseEnter={(e) => (e.currentTarget.style.paddingRight = '10px')}
      onMouseLeave={(e) => (e.currentTarget.style.paddingRight = '0')}
      type={type as any}
      disabled={disabled}
    >
      {buttonContent}
    </button>
  )
}
