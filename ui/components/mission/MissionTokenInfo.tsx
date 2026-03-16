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
    <div className="flex flex-col gap-6">
      {/* Token Distribution */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Token Distribution</h3>
        <p className="text-gray-400 leading-relaxed mb-5">
          50% of the total tokens go to contributors when funding the project. The other 50% are locked for at least one year, allocated as follows:
        </p>
        <div className="space-y-3">
          {[
            {
              pct: '2.5%',
              label: 'Locked indefinitely on an Automated Market Maker (AMM)',
              color: 'from-blue-500/20 to-blue-600/10',
              border: 'border-blue-500/20',
            },
            {
              pct: '17.5%',
              label: "Locked 1 year, vested 3 years — held by MoonDAO's Treasury",
              color: 'from-indigo-500/20 to-indigo-600/10',
              border: 'border-indigo-500/20',
            },
            {
              pct: '30%',
              label: 'Locked 1 year, vested 3 years — held by the Mission Team',
              color: 'from-purple-500/20 to-purple-600/10',
              border: 'border-purple-500/20',
            },
          ].map((item, index) => (
            <div
              key={index}
              className={`flex items-start gap-4 bg-gradient-to-r ${item.color} border ${item.border} rounded-xl p-4`}
            >
              <span className="text-white font-GoodTimes text-sm whitespace-nowrap mt-0.5">
                {item.pct}
              </span>
              <p className="text-gray-300 text-sm leading-relaxed">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-4 leading-relaxed">
          If the project does not launch (funding goal not met), contributors can get their full contribution back.
        </p>
      </div>

      {/* Vesting Schedule */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Vesting Schedule</h3>
        <div className="rounded-xl overflow-hidden border border-white/[0.06]">
          <Image
            src="/assets/launchpad/mission-locked-token-vesting.svg"
            alt="Token Vesting Schedule"
            width={500}
            height={300}
            className="w-full"
          />
        </div>
      </div>

      {/* Auditing Resources */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Auditing Resources</h3>
        <div className="flex flex-col gap-3">
          {token?.tokenSymbol && (
            <Link
              className="flex items-center gap-3 text-indigo-400 hover:text-indigo-300 transition-colors duration-200 group"
              href={`https://${
                process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                  ? 'etherscan.io'
                  : 'sepolia.etherscan.io'
              }/address/${token.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                <Image
                  src="/assets/launchpad/star-icon-indigo.svg"
                  alt="Etherscan"
                  width={16}
                  height={16}
                />
              </div>
              <span className="font-medium">View on Etherscan ↗</span>
            </Link>
          )}
          <Link
            className="flex items-center gap-3 text-indigo-400 hover:text-indigo-300 transition-colors duration-200 group"
            href={`https://${
              process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
                ? 'juicebox.money'
                : 'sepolia.juicebox.money'
            }/v4/p/${mission?.projectId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
              <Image
                src="/assets/launchpad/star-icon-indigo.svg"
                alt="Juicebox"
                width={16}
                height={16}
              />
            </div>
            <span className="font-medium">View on Juicebox ↗</span>
          </Link>
        </div>
      </div>

      <VestingWithdraw missionId={mission?.id} token={token} />
    </div>
  )
}
