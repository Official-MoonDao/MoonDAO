// footer.tsx
import Link from 'next/link'
import Disclaimer from './Disclaimer'
import LegalLinks from './LegalLinks'

interface FooterProps {
  darkBackground?: boolean
  centerContent?: boolean
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

export default function Footer({
  darkBackground = false,
  centerContent = false,
}: FooterProps) {
  return (
    <div
      id="footer-container"
      className={`flex flex-col items-center pt-5 max-w-[1200px] ${
        darkBackground ? 'w-full h-full' : 'pb-10'
      } ${centerContent ? 'text-center' : ''}`}
    >
      <div className="p-5">
        <Disclaimer isCentered={centerContent} />
      </div>
      <div className="mt-5 gradient-15 md:rounded-tl-[20px] xl:rounded-tr-[20px] pt-5 pb-20 w-full flex items-center justify-center"
      >
        <div>
          <LegalLinks isCentered={centerContent} />
        </div>
      </div>
    </div>
  )
}
