import Image from 'next/image'
import Link from 'next/link'
import VestingWithdraw from './VestingWithdraw'

export default function MissionTokenInfo({
  mission,
  token,
}: {
  mission: any
  token: any
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Tokenomics */}
      <h1 className="mt-4 text-2xl font-bold">Tokenomics</h1>
      <p>
        {`50% of the total tokens will go to the contributor when funding the project, and the other 50% are locked for at least one year, allocated as follows:`}
      </p>
      <Image
        src="/assets/launchpad/mission-tokenomics-distribution.svg"
        alt="Tokenomics"
        width={350}
        height={350}
      />
      <p>{`If funding is completed successfully, the locked tokens are treated as follows:`}</p>
      {[
        '10% of the token is locked indefinitely on an Automated Market Maker (AMM).',
        "10% of the token is locked for one year, and vested for three years, to be held by MoonDAO's Treasury.",
        '30% of the token is locked for one year, and vested for three years, to be held by the Mission Team to distribute how they see fit.',
      ].map((item: string, index: number) => (
        <p key={index} className="ml-1">{`● ${item}`}</p>
      ))}
      <p>{`If the project does not launch (their funding goal was not met), then contributors can get their full contribution back.`}</p>

      {/* Locked Token Vesting Schedule */}
      <h1 className="mt-4 text-2xl font-bold">Locked Token Vesting Schedule</h1>
      <Image
        src="/assets/launchpad/mission-locked-token-vesting.svg"
        alt="Token Vesting Schedule"
        width={500}
        height={500}
      />

      {/* Auditing Resources */}
      <h1 className="mt-4 text-2xl font-bold">Auditing Resources</h1>

      {token?.tokenSymbol && (
        <div className="flex items-center gap-2">
          <Image
            src="/assets/launchpad/star-icon-indigo.svg"
            alt="Star Icon"
            width={20}
            height={20}
          />
          <Link
            className="underline text-blue-500"
            href={`https://${
              process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                ? 'etherscan.io'
                : 'sepolia.etherscan.io'
            }/address/${token.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {'Etherscan'}
          </Link>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Image
          src="/assets/launchpad/star-icon-indigo.svg"
          alt="Star Icon"
          width={20}
          height={20}
        />
        <Link
          className="underline text-blue-500"
          href={`https://${
            process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
              ? 'juicebox.money'
              : 'sepolia.juicebox.money'
          }/v4/p/${mission?.projectId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {'Juicebox'}
        </Link>
      </div>
      <VestingWithdraw missionId={mission?.id} token={token} />
    </div>
  )
}
