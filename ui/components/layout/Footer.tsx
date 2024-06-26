import Link from 'next/link';

export default function Footer() {
  return ( 
    <div id="bottom-bar" 
      className="flex flex-row items-center justify-center p-5 pb-10 md:pb-5 max-w-[1200px]"
      >
      <Link 
        className="pr-5 opacity-[60%] hover:opacity-[100%]" 
        href="https://docs.moondao.com/Legal/Website-Privacy-Policy"  target="_blank">
        Privacy Policy 
      </Link>
      <span>
        &nbsp;|&nbsp;
      </span>
      <Link 
        className="pl-5 opacity-[60%] hover:opacity-[100%]" 
        href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions" target="_blank">
        Terms of Service
      </Link>
    </div>
  )
}
