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
  }, [validVP])

  return (
    <ReservationRaffleLayout title="Purchase">
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
            <p className="text-sm text-center lg:text-left ease-in-ease-out duration-300 text-opacity-80 leading-7">
              {`Use Promo Code "MOONDAO" at checkout to receive $1,000 off your flight!`}
            </p>
            <Button
              onClick={() => {
                window.open(
                  'https://d2fkch04.na1.hs-sales-engage.com/Ctc/RK+23284/d2FkCH04/Jl22-6qcW7lCdLW6lZ3kSW6VST4-6wXSpPW3D7m8y4KR-PlW91J_rQ6jzqY7W7tnnBn7vG0VqW20j_9P4Hg96-W1CYnbR5nJp3vW7Yfr7F1x0f5vW4g57z22cmfJTW2d_PST73ZnFhW2_JcNR325BWFN9hqVnM_lhw-W35smWZ100JznW99-WZ64MmSTYW8vTcMW3Q4H-sW46TTCz2GMSgsW6Q2FpK4HrFGxW6H41jV6BcfzLW8KyMSl4jXBLHW5-RT8W4M0F-8W30LNg_33vRbQW6dhhWB6sTKP8W7VxsmJ40RSd1W7PcwBx8g-Q54VnqgRD15xWDPf8s5qtP04'
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
