import { useEffect, useState } from 'react'
import ReservationRaffleLayout from './ReservationRaffleLayout'

function Button({ children, onClick }: any) {
  return (
    <button
      className="mt-4 py-3 text-white bg-moon-orange font-RobotoMono w-full duration-[0.6s] ease-in-ease-out text-1xl"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function PurchasePortal({ validLock }: any) {
  const [state, setState] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (state === 2 && validLock) setState(1)
  }, [validLock])

  return (
    <ReservationRaffleLayout title="Purchase">
      {state === 0 && (
        <>
          <Button
            onClick={() => {
              //check if wallet has vMooney
              if (validLock) {
                setState(1)
              } else setState(2)
            }}
          >
            Buy a ticket
          </Button>
        </>
      )}

      {state === 1 && (
        <>
          <div className="mt-3">
            <p className="text-sm text-center lg:text-left ease-in-ease-out duration-300 text-opacity-80 leading-7">
              {`Use Promo Code "MOONDAO" at checkout to receive $1,000 off your flight!`}
            </p>
            <Button
              onClick={() => {
                window.open(
                  'https://www.gozerog.com/reservations/moondao-spacefabw-flight/'
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
        <div className='mt-3'>
          <p className="text-sm text-center lg:text-left ease-in-ease-out duration-300 text-opacity-80 leading-7">{`Please connect a wallet that has vMooney to receive a discount code, otherwise press continue.`}</p>
          <Button
            onClick={() => {
              window.open(
                'https://www.gozerog.com/reservations/moondao-spacefabw-flight/'
              )
              setTimeout(() => {
                setState(0)
              }, 1000)
            }}
          >
            Continue
          </Button>
        </div>
      )}
    </ReservationRaffleLayout>
  )
}
