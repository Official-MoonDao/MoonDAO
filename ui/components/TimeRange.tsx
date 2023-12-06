import React from 'react'

export default function TimeRange({
  disabled,
  time,
  min,
  max,
  displaySteps,
  onChange,
}: any) {
  const step = (min * 100) / max

  return (
    <>
      <input
        type="range"
        min={min || 0}
        max={max || 0}
        value={time}
        onChange={(e) => {
          onChange(new Date(parseFloat(e.target.value)))
        }}
        className={`range mt-6  ${
          disabled ? 'btn-disabled' : ''
        }`}
        step={step || 0}
      />

      <div className="w-full flex justify-between text-xs px-2 mb-4 font-RobotoMono">
        {displaySteps ? (
          <>
            <p>-</p>

            <span className="lg:hidden">1 y</span>
            <span className="hidden lg:block">1 year</span>

            <span className="lg:hidden">2 y</span>

            <span className="hidden lg:block">2 years</span>

            <span className="lg:hidden">3 y</span>

            <span className="hidden lg:block">3 years</span>
          </>
        ) : (
          <>
            {' '}
            <span>Now</span>
            <span></span>
            <span></span>
            <span></span>
          </>
        )}

        <span className="lg:hidden">4 y</span>
        <span className="hidden lg:block">4 years</span>
      </div>
    </>
  )
}
