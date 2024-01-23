import Link from 'next/link'

function Winner({ number, name, tokenId, address, prize }: any) {
  return (
    <div
      className={`flex items-center gap-4 px-5 lg:px-7 xl:px-10 py-6 border-2 dark:border-[#ffffff20] font-RobotoMono w-[300px] md:w-[400px] lg:mt-10 lg:w-3/4 lg:max-w-[1080px] text-slate-950 text-sm dark:text-white ${
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
      <div className="flex flex-col w-full">
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
      <div className="flex w-1/2">
        <p>{prize}</p>
      </div>
    </div>
  )
}

export function SweepstakesWinners() {
  return (
    <>
      <div className="mt-5">
        <h2 className="page-title">Winners</h2>
        <div className="flex flex-col items-start">
          <Winner
            number={1}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`🚀 Ticket to Space on Blue Origin's New Shepard!`}
          />
          <Winner
            number={2}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 200,000 $MOONEY`}
          />
          <Winner
            number={3}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 100,000 $MOONEY`}
          />
          <Winner
            number={4}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 50,000 $MOONEY`}
          />
          <Winner
            number={5}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 50,000 $MOONEY`}
          />
          <Winner
            number={6}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 30,000 $MOONEY`}
          />
          <Winner
            number={7}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 30,000 $MOONEY`}
          />
          <Winner
            number={8}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 30,000 $MOONEY`}
          />
          <Winner
            number={9}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 30,000 $MOONEY`}
          />
          <Winner
            number={10}
            name={'Test'}
            tokenId={1}
            address={'0x1234567890123456789012345678901234567890'}
            prize={`💰 30,000 $MOONEY`}
          />
        </div>
      </div>
    </>
  )
}
