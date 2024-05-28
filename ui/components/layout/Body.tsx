import Footer from './Footer'; 
import React, { ReactNode } from 'react';

interface BodyProps {
    children: ReactNode;
    fullWidth?: boolean;
}

function Body({ children, fullWidth }: BodyProps) {
  return (
    <div id="body-element-section" className={`overflow-auto no-bar h-full min-h-[100vh] flex flex-col fixed top-0 ${fullWidth ? 'pl-5 z-50 w-full gradient-9 left-0' : 'mt-[50px] md:mt-0 right-0 w-[calc(100vw-20px)] md:w-[calc(100vw-260px)] lg:w-[calc(100vw-290px)]'}`}>
      <div id="content-container-section" className="flex-grow">
        {children}
      </div>  
      <div id="footer-container" className="min-h-[120px] md:min-h-[70px]">
        <Footer />
      </div>
    </div>
  );
}

export default Body;
