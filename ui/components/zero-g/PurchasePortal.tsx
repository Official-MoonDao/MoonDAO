import { useEffect, useState } from 'react'
import ReservationRaffleLayout from './ReservationRaffleLayout'

function Button({ children, onClick }: any) {
  return (
    <button
      className="border-style mt-4 tracking-wide btn text-n3blue normal-case font-medium font-GoodTimes w-full bg-transparent hover:bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function PurchasePortal({ validLock }: any) {
  const [state, setState] = useState(0)
  const [error, setError] = useState(false)

  return (
    <ReservationRaffleLayout title="Purchase">
      {state === 0 && (
        <>
          {error && (
            <p className="text-n3green ease-in-ease-out duration-300">{`Please connect a wallet that has vMooney`}</p>
          )}
          <Button
            onClick={() => {
              //check if wallet has vMooney
              if (validLock) {
                setState(1)
                setError(false)
              } else setError(true)
            }}
          >
            buy a ticket
          </Button>
        </>
      )}

      {state === 1 && (
        <>
          <div className="flex flex-col items-center">
            <p className="text-center text-n3blue">
              {`Use Promo Code "MOONDAO" at checkout to receive $2,500 off your flight!`}
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
              continue
            </Button>
          </div>
        </>
      )}
    </ReservationRaffleLayout>
  )
}
