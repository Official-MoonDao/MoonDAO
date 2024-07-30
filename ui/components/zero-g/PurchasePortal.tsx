import { useEffect, useState } from 'react'
import ReservationRaffleLayout from './ReservationRaffleLayout'

function Button({ children, onClick, className = '' }: any) {
  return (
    <button
      className={`mt-4 py-3 text-white bg-moon-orange font-RobotoMono w-full duration-[0.6s] ease-in-ease-out text-1xl ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function PurchasePortal({ validVP }: any) {
  const [state, setState] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (state === 2 && validVP.validLock) setState(1)
  }, [validVP, state])

  return (
    <>
      {state === 0 && (
        <>
          <Button
            onClick={() => {
              // check if wallet has vMooney
              if (validVP.validLock) {
                setState(1)
              } else setState(2)
            }}
          >
            Purchase
          </Button>
        </>
      )}

      {state === 1 && (
        <>
          <div className="mt-3">
            <p className="text-sm text-center lg:text-left ease-in-ease-out duration-300 text-opacity-80 leading-7 font-RobotoMono">
              {`Use Promo Code ${process.env.NEXT_PUBLIC_ZERO_G_PROMO_CODE} at checkout to receive $1,000 off your flight!`}
            </p>
            <Button
              onClick={() => {
                window.open(
                  'https://www.gozerog.com/ksc-with-md-and-spacefabw/'
                )
                setTimeout(() => {
                  setState(0)
                }, 1000)
              }}
            >
              Continue
            </Button>
          </div>
        </>
      )}
      {state === 2 && (
        <div className="mt-3">
          <p className="text-sm text-center lg:text-left ease-in-ease-out duration-300 text-opacity-80 leading-7 font-RobotoMono">{`MoonDAO members can claim $1,000 off, please connect a wallet that has voting power to receive a discount code, otherwise press continue.`}</p>
          <Button
            onClick={() => {
              window.open('https://www.gozerog.com/ksc-with-md-and-spacefabw/')
              setTimeout(() => {
                setState(0)
              }, 1000)
            }}
          >
            Continue
          </Button>
        </div>
      )}
    </>
  )
}
