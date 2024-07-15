// footer.tsx

import Link from 'next/link';

export default function Footer() {
    return (
        <div id="footer-container" className="flex flex-col items-center pt-5 pb-10 max-w-[1200px]">
            <div id="disclaimer-container" className="p-5 md:pl-[45px] lg:pl-[80px]">
                <span className="">
                    <div className="inline-block">
                        <span className="opacity-[60%]">
                            <strong>Disclaimer:&nbsp;</strong> 
                            There is no expectation of profit with the $MOONEY token. It is a governance token. You are not receiving fractionalized ownership of the DAO's assets in exchange for the token, check the&nbsp;
                        </span>
                        <u>
                            <Link id="FAQ-link" className="opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/About/FAQ" target="_blank">FAQ</Link>
                        </u>
                        <span className="opacity-[60%]">
                            . Always make sure you are interacting with our official token address on the Ethereum mainnet: 
                        </span>    
                        <span className="opacity-[60%] hover:opacity-[100%] break-all">
                            <u>
                                <Link id="token-link" href="https://docs.moondao.com/Governance/Governance-Tokens" target="_blank">
                                    &nbsp;0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395
                                </Link>
                            </u>
                        </span>
                    </div>
                </span>
            </div>
            <div className="flex items-center justify-center min-h-[150px] md:min-h-[0px]"> 
                <Link className="pr-5 opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/Legal/Website-Privacy-Policy" target="_blank">Privacy Policy</Link>
                <span>&nbsp;|&nbsp;</span>
                <Link className="pl-5 opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions" target="_blank">Terms of Service</Link>
            </div>
        </div>
    )
}
