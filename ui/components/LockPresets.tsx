import React from 'react'

export default function LockPresets({
  disabled,
  expirationTime,
  min,
  max,
  onChange,
}: any) {
  const currTime = new Date()

  return (
    <div className="flex flex-horizontal flex-fill mt-3 space-x-2">
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+6)))
            }}
            className={`h-5 btn-primary flex-auto normal-case rounded-full text-xs basis-1/5${
                currTime.getTime()+15778463000 < expirationTime
                ? 'border-disabled btn-disabled' 
                : ''
                }`}>
            6mo
        </button>
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+12)))
            }}
            className={`h-5 btn-primary flex-auto normal-case rounded-full text-xs basis-1/5${
                currTime.getTime()+31556926000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : ''
                }`}>
            1y
        </button>
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+24)))
            }}
            className={`h-5 btn-primary flex-auto normal-case rounded-full text-xs basis-1/5${
                currTime.getTime()+63113852000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : ''
                }`}>
            2y
        </button>
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+48)))
            }}
            className={`h-5 btn-primary flex-auto normal-case rounded-full text-xs basis-1/5${
                currTime.getTime()+126227704000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : ''
                }`}>
            4y
        </button>

    </div>
  )
}
