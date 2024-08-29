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
                            . Always make sure you are interacting with an&nbsp;
                        </span>
                        <span className="opacity-[60%] hover:opacity-[100%]">
                            <u>
                                <Link id="token-link" href="https://docs.moondao.com/Governance/Governance-Tokens" target="_blank">
                                official token address
                                </Link>
                            </u>
                        </span>
                        <span className="opacity-[60%]">
                            :&nbsp;
                        </span>  
                        <span className="opacity-[60%] hover:opacity-[100%] break-all">
                            <u>
                                <Link id="token-link" href="https://etherscan.io/token/0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395" target="_blank">
                                    Ethereum
                                </Link>
                            </u>
                        </span>
                        <span className="opacity-[60%]">
                            ,&nbsp;
                        </span>   
                        <span className="opacity-[60%] hover:opacity-[100%] break-all">
                            <u>
                                <Link id="token-link" href="https://polygonscan.com/token/0x74ac7664abb1c8fa152d41bb60e311a663a41c7e" target="_blank">
                                    Polygon
                                </Link>
                            </u>
                        </span>
                        <span className="opacity-[60%]">
                            , or&nbsp;
                        </span>  
                        <span className="opacity-[60%] hover:opacity-[100%] break-all">
                            <u>
                                <Link id="token-link" href="https://arbiscan.io/token/0x1Fa56414549BdccBB09916f61f0A5827f779a85c" target="_blank">
                                    Arbitrum
                                </Link>
                            </u>
                        </span>
                        <span className="opacity-[60%]">
                            .
                        </span>  
                    </div>
                </span>
            </div>
            <div className="flex items-center justify-center min-h-[80px] md:min-h-[0px]"> 
                <Link className="pr-5 opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/Legal/Website-Privacy-Policy" target="_blank">Privacy Policy</Link>
                <span>&nbsp;|&nbsp;</span>
                <Link className="pl-5 opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/Legal/Website-Terms-and-Conditions" target="_blank">Terms of Service</Link>
            </div>
        </div>
    )
}