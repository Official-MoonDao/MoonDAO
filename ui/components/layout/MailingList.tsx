function MailingList() {
  return (
    <form id="mailinglist-form" className="flex flex-col items-center max-w-[500px] md:flex-row md:mt-5 pb-10 rounded-md w-full">
        <input id="email-field" className="py-5 px-5 bg-dark-cool focus:outline-none focus:ring-white-500 px-3 py-2 rounded-tl-[10px] md:rounded-bl-[10px] rounded-bl-0 w-full" type="email" placeholder="Enter your email" />
        <button id="button" className="p-5 pr-5 pl-5 bg-white duration-500 focus:outline-none font-GoodTimes hover:pl-10 md:rounded-bl-0 rounded-bl-[10px] rounded-br-[10px] text-dark-cool w-full lg:bg-white" type="submit">Learn More</button>
    </form>
  );
}

export default MailingList;
