// footer.tsx
import Link from 'next/link'

interface FooterProps {
  darkBackground?: boolean
}

type FooterTokenLinkProps = {
  href: string
  label: string
}

function FooterTokenLink({ href, label }: FooterTokenLinkProps) {
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

export default function Footer({ darkBackground = false }: FooterProps) {
  return (
    <div
      id="footer-container"
      className={`flex flex-col items-center pt-5 max-w-[1200px] ${
        darkBackground ? 'w-full h-full' : 'pb-10'
      }`}
    >
      <div id="disclaimer-container" className="p-5 ">
        <span className="break-words">
          <div className="inline-block">
            <span className="opacity-[60%]">
              <strong>Disclaimer:&nbsp;</strong>
              There is no expectation of profit with the $MOONEY token. It is a
              governance token. You are not receiving fractionalized ownership
              of the DAO's assets in exchange for the token, check the&nbsp;
            </span>
            <u>
              <Link
                id="FAQ-link"
                className="opacity-[60%] hover:opacity-[100%]"
                href="https://docs.moondao.com/About/FAQ"
                target="_blank"
              >
                FAQ
              </Link>
            </u>
            <span className="opacity-[60%]">
              . Always make sure you are interacting with an&nbsp;
            </span>
            <FooterTokenLink
              label="official token address"
              href="https://docs.moondao.com/Governance/Governance-Tokens"
            />
            <span className="opacity-[60%]">:&nbsp;</span>
            <FooterTokenLink
              label="Ethereum"
              href="https://etherscan.io/token/0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395"
            />
            <span className="opacity-[60%]">,&nbsp;</span>
            <FooterTokenLink
              label="Polygon"
              href="https://polygonscan.com/token/0x74ac7664abb1c8fa152d41bb60e311a663a41c7e"
            />
            <span className="opacity-[60%]">,&nbsp;</span>
            <FooterTokenLink
              label="Arbitrum"
              href="https://arbiscan.io/token/0x1Fa56414549BdccBB09916f61f0A5827f779a85c"
            />
            <span className="opacity-[60%]">, or&nbsp;</span>
            <FooterTokenLink
              label="Base"
              href="https://basescan.org/address/0x6585a54A98fADA893904EB8A9E9CDFb927bddf39"
            />

            <span className="opacity-[60%]">.</span>
          </div>
        </span>
      </div>
      <div
        className={` w-full pb-10 md:pb-5 ${
          darkBackground
            ? 'mt-5 gradient-15 md:rounded-tl-[20px] xl:rounded-tr-[20px] pt-5 pb-20 w-full h-full'
            : 'mob-footer-gradient'
        }`}
      >
        <div
          id="bottom-links-container"
          className={`flex items-center justify-center min-h-[80px] md:min-h-[0px]`}
        >
          <Link
            className="pr-5 opacity-[60%] hover:opacity-[100%]"
            href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
            target="_blank"
          >
            Privacy Policy
          </Link>
          <span>&nbsp;|&nbsp;</span>
          <Link
            className="pl-5 opacity-[60%] hover:opacity-[100%]"
            href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"
            target="_blank"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  )
}
