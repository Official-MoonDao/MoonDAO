import { useRef, useState } from 'react'

function Button({ children, onClick }: any) {
  return (
    <button
      className="border-style mt-4 tracking-wide btn text-n3blue normal-case font-medium font-GoodTimes w-full  bg-transparent hover:bg-n3blue hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function EnterRaffleButton({
  setState,
  address,
  validLock,
  hasTicket,
  label = 'Enter Sweepstakes',
}: any) {
  const disclaimerRef: any = useRef()
  const [dropdown, setDropdown] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  if (dropdown) {
    return (
      <div className="flex flex-col justify-center items-center gap-4 mt-2">
        <p className="font-RobotoMono mt-3 text-lg">
          Are you a vMooney Holder?
        </p>
        {error !== '' && (
          <p className="text-n3green ease-in duration-300">{error}</p>
        )}
        <Button
          onClick={async () => {
            if (!address)
              return setError('Please connect a wallet that has vMooney')
            if (!validLock) return setError('This wallet does not have vMooney')
            if (hasTicket && +hasTicket.toString() === 1)
              return setError('You have already entered the raffle!')
            setState(2)
          }}
        >
          Yes
        </Button>
        <Button onClick={async () => setState(1)}>No</Button>
        <button
          className="mt-4 tracking-wide btn text-gray-100 normal-case font-medium font-GoodTimes w-full bg-red-500 hover:bg-red-600 hover:text-white duration-[0.6s] ease-in-ease-out text-1xl"
          onClick={() => setDropdown(false)}
        >
          Cancel ✖
        </button>
        <div
          className="text-[80%] text-center flex flex-col gap-2 border-white rounded-2xl border-[0.5px] p-4"
          ref={disclaimerRef}
        >
          <p>
            {`NO PURCHASE OF A TICKET TO ZERO-G NFT IS NECESSARY TO ENTER THE SWEEPSTAKES OR WIN A
                  CHANCE TO FLY TO SPACE.  PURCHASE OF A TICKET TO SPACE NFT WILL NOT INCREASE YOUR ODDS OF
                  WINNING A PRIZE.
                  `}
          </p>

          <hr></hr>
          <p>
            {`
            Sweepstakes are open only to individuals who are 18 years of age or
            older, or the age of majority if greater than 18 in their respective
            jurisdictions. Sweepstakes is void in Florida, New York, Puerto Rico
            and where otherwise prohibited by law. Alternate prize winners are
            responsible for taxes associated with the prizes. Odds of winning
            depend on the number of entries received during the contest period
            (maximum tickets = 162), but can be calculated by dividing the
            number of prizes by the total number of entries received. Sponsor:
            MoonDAO Limited d/b/a MoonDAO. Contest ends on April 30th, 2023.`}
          </p>
          <hr></hr>
          <p className="italic">
            For Alternative Method of Entry, select "NO" above.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Button
      onClick={() => {
        setDropdown(true)
        setTimeout(() => {
          disclaimerRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        }, 300)
      }}
    >
      {label}
    </Button>
  )
}
