function MailingList() {
return (
    <form id="mailinglist-form" className="">
        <div className="flex flex-col items-center max-w-[600px] md:flex-row w-full border-2 border-dark-cool rounded-[2vmax] rounded-tl-[10px] mb-[60px] lg:mb-0 overflow-hidden">  
            <input id="email-field" className="py-5 px-5 bg-dark-cool focus:outline-none focus:ring-white-500 px-3 py-2 w-full" type="email" placeholder="Enter your email" />
            <button id="button" className="p-5 pr-5 pl-5 bg-white duration-500 focus:outline-none font-GoodTimes hover:pl-10 text-dark-cool w-full lg:bg-white" type="submit">Learn More</button>
        </div>  
    </form>
);
}

export default MailingList;
