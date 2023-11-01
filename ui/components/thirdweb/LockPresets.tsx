import React from 'react'

export default function LockPresets({
  disabled,
  expirationTime,
  onChange,
}: any) {
  const currTime = new Date()

  return (
    <div className="flex flex-horizontal flex-fill mt-3 space-x-2 text-gray-900 dark:text-white font-RobotoMono">
      <button
        onClick={() => {
          onChange(new Date(currTime.setMonth(currTime.getMonth() + 6)))
        }}
        className={`py-1 flex-auto normal-case rounded-lg text-xs basis-1/5 border border-gray-700 dark:border-white ${
          currTime.getTime() + 15778463000 < expirationTime || disabled
            ? 'opacity-70'
            : ''
        }`}
      >
        <span className="lg:hidden">6mo</span>
        <span className="hidden lg:block">6 months</span>
      </button>
      <button
        onClick={() => {
          onChange(new Date(currTime.setMonth(currTime.getMonth() + 12)))
        }}
        className={`py-1 flex-auto normal-case rounded-lg text-xs basis-1/5 border border-gray-700 dark:border-white ${
          currTime.getTime() + 31556926000 < expirationTime || disabled
            ? 'opacity-70'
            : ''
        }`}
      >
        <span className="lg:hidden">1y</span>
        <span className="hidden lg:block">1 year</span>
      </button>
      <button
        onClick={() => {
          onChange(new Date(currTime.setMonth(currTime.getMonth() + 24)))
        }}
        className={`py-1 flex-auto normal-case rounded-lg text-xs basis-1/5 border border-gray-700 dark:border-white ${
          currTime.getTime() + 63113852000 < expirationTime || disabled
            ? 'opacity-70'
            : ''
        }`}
      >
        <span className="lg:hidden">2y</span>
        <span className="hidden lg:block">2 years</span>
      </button>
      <button
        onClick={() => {
          onChange(new Date(currTime.setMonth(currTime.getMonth() + 48)))
        }}
        className={`py-1 flex-auto normal-case rounded-lg text-xs basis-1/5 border border-gray-700 dark:border-white ${
          currTime.getTime() + 126227704000 < expirationTime || disabled
            ? 'opacity-70'
            : ''
        }`}
      >
        <span className="lg:hidden">4y</span>
        <span className="hidden lg:block">4 years</span>
      </button>
    </div>
  )
}
