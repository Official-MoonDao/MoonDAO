//StandardButtonRight.tsx
import PropTypes from 'prop-types'
import React from 'react'

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
}) {
  const buttonContent = (
    <button
      className={`
        standardbutton transition-all duration-200       
        ${backgroundColor} 
        ${borderRadius} 
        ${className} 
      `}
      onClick={onClick || null}
      style={{ paddingRight: '0' }}
      onMouseEnter={(e) => (e.currentTarget.style.paddingRight = '10px')}
      onMouseLeave={(e) => (e.currentTarget.style.paddingRight = '0')}
      type={type as any}
      disabled={disabled}
    >
      <div
        id="button-content"
        className={` 
          py-3 px-5 rounded-[2vmax] rounded-tr-[10px]
          ${textColor}
        `}
      >
        {children}
      </div>
    </button>
  )

  return styleOnly ? buttonContent : <a href={link}>{buttonContent}</a>
}

StandardButtonRight.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  backgroundColor: PropTypes.string,
  hoverColor: PropTypes.string,
  borderRadius: PropTypes.string,
  link: PropTypes.string,
  paddingOnHover: PropTypes.string,
  textColor: PropTypes.string,
  styleOnly: PropTypes.bool,
  type: PropTypes.any,
}
