//StandardButton.tsx
import React from 'react';
import PropTypes from 'prop-types';

export default function StandardButton({
    className = '',
    children = 'ReactNode',
    onClick = () => {},
    backgroundColor = 'dark-cool',
    hoverColor = 'mid-cool',
    borderRadius = 'rounded',
    link = '#',
    paddingOnHover = 'pl-5',
    textColor = 'text-white',
    styleOnly = false, 
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
      style={{ paddingLeft: '0' }}
      onMouseEnter={(e) => (e.currentTarget.style.paddingLeft = '20px')}
      onMouseLeave={(e) => (e.currentTarget.style.paddingLeft = '0')}
    >
      <div id="button=content" 
        className={` 
          p-2 pb-3 pr-5 pl-5 
          ${textColor}
        `}
        >
        {children}
      </div>
    </button>
  );

  return styleOnly ? buttonContent : <a href={link}>{buttonContent}</a>;
}

StandardButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  backgroundColor: PropTypes.string,
  hoverColor: PropTypes.string,
  borderRadius: PropTypes.string,
  link: PropTypes.string,
  paddingOnHover: PropTypes.string,
  textColor: PropTypes.string,
  styleOnly: PropTypes.bool, 
};