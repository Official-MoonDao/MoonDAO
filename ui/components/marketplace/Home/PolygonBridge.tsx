import Link from 'next/link'

export default function PolygonBridge({ linked }: any) {
  return (
    <div>
      <button
        onClick={() =>
          window.open(
            'https://wallet.polygon.technology/polygon/bridge/deposit'
          )
        }
        className="bridge-button"
      >
        {`${
          process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'Polygon' : 'Mumbai'
        } Bridge`}
      </button>
      {linked && (
        <>
          <h1 className="text-center md:text-left text-[80%] opacity-70 leading-6 pr-2 pt-3">
            {`The marketplace uses L2 MOONEY, use the bridge to transfer L1
        MOONEY (${
          process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'Mainnet' : 'Goerli'
        }) to L2`}
            <Link className="ml-2 font-bold text-moon-gold" href={'/bridge'}>
              Learn more →
            </Link>
          </h1>
        </>
      )}
    </div>
  )
}
