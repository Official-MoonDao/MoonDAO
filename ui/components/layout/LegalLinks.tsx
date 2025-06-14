import Link from 'next/link'

interface LegalLinksProps {
  isCentered?: boolean
}

export default function LegalLinks({ isCentered = true }: LegalLinksProps) {
  return (
    <div className={`w-full flex items-center ${isCentered ? 'justify-center' : 'justify-start'} min-h-[80px] md:min-h-[0px]`}>
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
  )
} 