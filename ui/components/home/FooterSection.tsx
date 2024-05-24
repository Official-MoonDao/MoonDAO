import Footer from '../layout/Footer'; 

export default function FooterSection() {
    return ( 
        <section>  
            <div className="CONTAINER relative flex md:min-h-[500px] lg:min-h-[0px]  ">
                <div className="BACKGROUND">  
                    <div className="BACKGROUND-GRADIENT gradient-1 w-full h-full absolute bottom-0 left-0 md:rounded-bl-[5vmax] overflow-hidden"></div>
                    <div className="BOTTOM-RIGHT-DIVIDER divider-7 bg-bottom absolute bottom-[-2px] right-[-20%] md:right-0 w-[60%] md:w-[60%] lg:w-[40%] h-full "></div>
                </div>
                <div className="CONTENT-SECTION flex flex-col max-w-[1200px] w-full">
                    <div className="CONTENT-CONTAINER z-10 flex flex-col lg:flex-row ">   
                        <div className="TOP-LEFT-DIVIDER divider-6 w-full h-[200px] lg:h-[auto] mt-[-1px]"></div>
                        <div className="CONTENT p-5 pb-10 pt-0 lg:pt-5 md:pb-20 flex flex-col lg:ml-[-20%] m-full max-w-[600px]">
                            <h1 className="header font-GoodTimes leading-none flex flex-col">
                                <span style={{fontSize: 'calc(max(7vmin, 30px))'}} className="mt-[5vmax]">Join Our </span>
                                <span style={{fontSize: 'calc(max(10vmin, 30px))'}} className="mt-[1vmin]">MISSION </span>
                            </h1>
                            <p className="PARAGRAPH w-full pt-2 pb-5 mr-5">MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement. We aim to accelerate the development of a lunar base through better coordination. Want to help? Learn how to contribute to our mission, even if you're new to Web3, and get weekly updates.</p>
                            <form className="FORM-CONTAINER w-full max-w-[300px] md:mt-5 flex flex-col md:flex-row items-center rounded-md pb-10">
                                <input className="INPUT-FIELD w-full bg-dark-cool rounded-tl-[10px] rounded-bl-0 md:rounded-bl-[10px] px-3 py-2  focus:outline-none focus:ring-white-500" type="email" placeholder="Enter your email" />
                                <button className="BUTTON rounded-bl-[10px] md:rounded-bl-0 rounded-br-[10px] w-full px-4 py-2 bg-white lg:bg-white text-dark-cool font-GoodTimes hover:pl-5 duration-500 focus:outline-none " type="submit">Subscribe</button>
                            </form>
                        </div>
                    </div> 
                </div>
            </div>
            <div className="BOTTOM-BAR gradient-8">
                <div className="FOOTER-CONTAINER flex pt-5 flex-col max-w-[1200px]">
                    <p className=" p-5">
                        <span className="opacity-[60%]">
                            Disclaimer: There is no expectation of profit with the $MOONEY token. It is a governance token. You are not receiving fractionalized ownership of the DAOs assets in exchange for the token, check &nbsp;
                        </span>
                        <span>
                            <u>
                                <a className="opacity-[60%] hover:opacity-[100%]" href="https://docs.moondao.com/About/FAQ">our FAQs</a>
                            </u> 
                        </span>    
                        <span  className="opacity-[60%]">
                            &nbsp;for more information and disclaimers.
                        </span>
                    </p>
                    <div className="min-h-[150px] md:min-h-[0px]">
                        <Footer />
                    </div>
                </div>
            </div>    
        </section>
    )
}
