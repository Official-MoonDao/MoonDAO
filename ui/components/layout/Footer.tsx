export default function Footer() {
  return ( 
    <div id="bottom-bar" 
      className="flex flex-row items-center justify-center p-5 md:pb-10 max-w-[1200px]"
      >
      <a 
        className="pr-5 opacity-[60%] hover:opacity-[100%]" 
        href="https://docs.moondao.com/Legal/Website-Privacy-Policy"
        >
        Privacy Policy 
      </a>
      <span>
        &nbsp;|&nbsp;
      </span>
      <a 
        className="pl-5 opacity-[60%] hover:opacity-[100%]" 
        href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions"
        >
        Terms of Service
      </a>
    </div>
  )
}
