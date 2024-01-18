import Link from 'next/link'

function Winner({ number, name, tokenId, address, prize }: any) {
  return (
    <div
      className={`flex items-center gap-4 px-5 lg:px-7 xl:px-10 py-6 border-2 dark:border-[#ffffff20] font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-3/4 lg:max-w-[1080px] text-slate-950 text-sm dark:text-white ${
        number === 1 && 'border-moon-gold dark:border-moon-gold'
      }`}
    >
      <h1
        className={`font-[Goodtimes] text-2xl ${
          number === 1 && 'text-moon-gold'
        }`}
      >
        {number}
      </h1>
      <div
        className={`w-[2px] h-12 bg-[#00000020] dark:bg-[#ffffff20] ${
          number === 1 && 'bg-moon-gold dark:bg-moon-gold'
        }`}
      />
      <div className="flex flex-col">
        <p>{`Name : ${name}`}</p>
        <p>{`Token Id : ${tokenId}`}</p>
        <Link
          href={'https://polygonscan.com/address/' + address}
          target="_blank"
        >
          {`Address : ${address?.slice(0, 6)}...${address?.slice(-4)}`}
        </Link>
      </div>
      <div
        className={`w-[2px] h-12 bg-[#00000020] dark:bg-[#ffffff20] ${
          number === 1 && 'bg-moon-gold dark:bg-moon-gold'
        }`}
      />

      <p>{prize}</p>
    </div>
  )
}

export function SweepstakesWinners() {
  return (
    <div className="mt-3 px-5 lg:px-7 xl:px-10 py-12 lg:py-14 page-border-and-color font-RobotoMono w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] text-slate-950 dark:text-white">
      <h1 className={`page-title`}>Ticket to Space</h1>
      <p className="mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] xl:text-left text-sm xl:text-base">
        {`One person will be randomly selected to win an opportunity aboard a future Blue Origin rocket to space!`}
      </p>

      <div className="mt-5">
        <h2 className="text-xl font-bold">Winners</h2>
        <div className="flex flex-col items-center">
          <Winner
            number={1}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'Blue Origin Rocket Ride to Space'}
          />
          <Winner
            number={2}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'200,000 $MOONEY'}
          />
          <Winner
            number={3}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'100,000 $MOONEY'}
          />
          <Winner
            number={4}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'50,000 $MOONEY'}
          />
          <Winner
            number={5}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'50,000 $MOONEY'}
          />
          <Winner
            number={6}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'30,000 $MOONEY'}
          />
          <Winner
            number={7}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'30,000 $MOONEY'}
          />
          <Winner
            number={8}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'30,000 $MOONEY'}
          />
          <Winner
            number={9}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'30,000 $MOONEY'}
          />
          <Winner
            number={10}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={'30,000 $MOONEY'}
          />
        </div>
      </div>
    </div>
  )
}
