import React from 'react';
import PropTypes from 'prop-types';

export default function StandardButton({
    className = '',
    children,
    onClick = () => {},
    backgroundColor = 'dark-cool',
    hoverColor = 'mid-cool',
    borderRadius = 'rounded',
    link = '#',
    paddingOnHover = 'pl-5',
    textColor = 'text-white',
}) {
  return (
    <a href={link}>
      <button
        className={`${backgroundColor} ${borderRadius} ${className} standardbutton transition-all duration-200`}
        onClick={onClick || null}
        style={{ paddingLeft: '0' }}
        onMouseEnter={(e) => (e.currentTarget.style.paddingLeft = '20px')}
        onMouseLeave={(e) => (e.currentTarget.style.paddingLeft = '0')}
      >
        <div className={`p-5 pr-10 pl-10 font-GoodTimes ${textColor}`}>
          {children}
        </div>
      </button>
    </a>
  );
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
};
