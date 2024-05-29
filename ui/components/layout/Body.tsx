import React, { ReactNode } from 'react';

interface BodyProps {
    children: ReactNode;
    fullWidth?: boolean;
}

function Body({ children, fullWidth }: BodyProps) {
  return (
    <div id="body-element-section" className={`overflow-auto no-bar h-full max-w-[100vw] min-h-[100vh] flex flex-col fixed top-0 ${fullWidth ? 'z-50 w-full gradient-9 left-0' : 'mt-[50px] md:mt-0 right-0 md:w-[calc(100vw-260px)] lg:w-[calc(100vw-290px)]'}`}>
      <div id="content-container-section" className="flex-grow">
        {children}
      </div>  
    </div>
  );
}

export default Body;
