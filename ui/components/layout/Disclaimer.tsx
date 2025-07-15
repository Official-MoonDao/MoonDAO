import Link from 'next/link'

interface DisclaimerProps {
  isCentered?: boolean
}

type TokenLinkProps = {
  href: string
  label: string
}

function TokenLink({ href, label }: TokenLinkProps) {
  return (
    <span className="opacity-[60%] hover:opacity-[100%]">
      <u>
        <Link id="token-link" href={href} target="_blank">
          {label}
        </Link>
      </u>
    </span>
  )
}

export default function Disclaimer({ isCentered = false }: DisclaimerProps) {
  return (
    <div className={`w-full ${isCentered ? 'flex justify-center' : ''}`}>
      <div className={`text-sm sm:text-base leading-relaxed ${isCentered ? 'text-center' : ''} max-w-none`}>
        <span className="opacity-[60%]">
          <strong>Disclaimer:</strong> There is no expectation of profit with the $MOONEY token. It is a governance token. You are not receiving fractionalized ownership of the DAO's assets in exchange for the token, check the{' '}
          <u>
            <Link
              id="FAQ-link"
              className="hover:opacity-[100%]"
              href="https://docs.moondao.com/About/FAQ"
              target="_blank"
            >
              FAQ
            </Link>
          </u>
          . Always make sure you are interacting with an{' '}
          <TokenLink
            label="official token address"
            href="https://docs.moondao.com/Governance/Governance-Tokens"
          />
          :{' '}
          <TokenLink
            label="Ethereum"
            href="https://etherscan.io/token/0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395"
          />
          ,{' '}
          <TokenLink
            label="Polygon"
            href="https://polygonscan.com/token/0x74ac7664abb1c8fa152d41bb60e311a663a41c7e"
          />
          ,{' '}
          <TokenLink
            label="Arbitrum"
            href="https://arbiscan.io/token/0x1Fa56414549BdccBB09916f61f0A5827f779a85c"
          />
          , or{' '}
          <TokenLink
            label="Base"
            href="https://basescan.org/address/0x6585a54A98fADA893904EB8A9E9CDFb927bddf39"
          />
          .
        </span>
      </div>
    </div>
  )
} 