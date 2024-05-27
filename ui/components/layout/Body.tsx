import Footer from './Footer'; 
import React, { ReactNode } from 'react';

interface BodyProps {
    children: ReactNode;
    fullWidth?: boolean;
}

function Body({ children, fullWidth }: BodyProps) {
  return (
    <div id="body-element" className={`flex flex-col items-between z-50 animate-fadeIn h-full min-h-[100vh] overflow-y-auto overflow-x-hidden no-bar ${fullWidth ? 'ml-5 w-full gradient-9 fixed top-0 left-0 ' : 'absolute top-0 right-0 w-full md:w-[calc(100vw-260px)] lg:w-[calc(100vw-290px)]'}`}>
      <div id="content-container" className="">
        {children}
      </div>  
      <div id="footer-container" className=" h-full">
        <Footer />
      </div>
    </div>
  );
}

export default Body;
