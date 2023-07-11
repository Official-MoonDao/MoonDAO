import React from 'react'

export default function LockPresets({
  disabled,
  expirationTime,
  onChange,
}: any) {
  const currTime = new Date()

  return (
    <div className="flex flex-horizontal flex-fill mt-3 space-x-2 text-black">
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+6)))
            }}
            className={`h-5 flex-auto normal-case rounded-full text-xs basis-1/5 ${
                currTime.getTime()+15778463000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : 'bg-primary'
                }`}>
            6mo
        </button>
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+12)))
            }}
            className={`h-5 flex-auto normal-case rounded-full text-xs basis-1/5 ${
                currTime.getTime()+31556926000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : 'bg-primary'
                }`}>
            1y
        </button>
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+24)))
            }}
            className={`h-5 flex-auto normal-case rounded-full text-xs basis-1/5 ${
                currTime.getTime()+63113852000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : 'bg-primary'
                }`}>
            2y
        </button>
        <button 
            onClick={ () => {
                onChange(new Date(currTime.setMonth(currTime.getMonth()+48)))
            }}
            className={`h-5 flex-auto normal-case rounded-full text-xs basis-1/5 ${
                currTime.getTime()+126227704000 < expirationTime || disabled
                ? 'border-disabled btn-disabled' 
                : 'bg-primary'
                }`}>
            4y
        </button>

    </div>
  )
}
