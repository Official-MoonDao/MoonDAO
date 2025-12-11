import React from 'react'
import MailingList from './MailingList'

export default function PreFooter({ mode = 'Default' }) {
  return (
    <section id="prefooter-container" className="m-width-[100vw]">
      <div
        id="prefooter"
        className={`relative flex ${
          mode === 'compact' ? 'md:min-h-[500px] lg:min-h-[0px] md:ml-0 md:p-0' : ''
        }`}
      >
        <div id="background">
          <div
            id="background-gradient"
            className={`w-full h-full absolute bottom-0 left-0 overflow-hidden bg-gradient-to-r from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 ${
              mode === 'compact'
                ? 'rounded-tr-[5vmax] rounded-tl-[5vmax] rounded-br-[5vmax] rounded-bl-[5vmax] md:rounded-tl-[20px] md:rounded-tr-[20px] md:rounded-br-[20px] md:rounded-bl-[20px]'
                : ''
            }`}
          ></div>
          {mode === 'Default' && (
            <div
              id="bottom-right-divider"
              className="hidden md:block  bg-bottom absolute bottom-[-2px] right-[-20%] md:right-0 w-[60%] md:w-[60%] lg:w-[40%] h-full"
            ></div>
          )}
        </div>
        <div id="content-section" className="flex flex-col w-full">
          <div id="content-container" className="z-10 flex flex-col lg:flex-row w-full">
            {mode === 'Default' && (
              <div
                id="top-left-divider"
                className={'divider-6 w-full h-[200px] lg:h-[80%] mt-[-1px]'}
              ></div>
            )}
            <div
              id="content"
              className={`${
                mode === 'compact'
                  ? 'p-6 md:p-5 md:px-10 pb-6 md:pb-20 pt-6 md:pt-0 lg:pt-5'
                  : 'p-5 px-5 md:p-5 md:px-10 pb-5 pt-0 lg:pt-5 md:pb-20'
              } flex flex-col m-full ${
                mode === 'compact' ? 'max-w-full lg:ml-0' : 'max-w-[600px] lg:ml-[-20%]'
              }`}
            >
              <h1 className="header font-GoodTimes leading-none flex flex-col text-white">
                <span
                  style={{ fontSize: 'calc(max(4vmin, 30px))' }}
                  className={mode === 'compact' ? 'mt-0 md:mt-[5vmax]' : 'mt-[5vmax]'}
                >
                  Join Our
                </span>
                <span style={{ fontSize: 'calc(max(6vmin, 30px))' }}>MISSION</span>
              </h1>
              <p
                id="paragraph"
                className={`w-full pt-2 pb-5 ${
                  mode === 'compact' ? 'pr-0 md:pr-5 mr-0 md:mr-5' : 'pr-0 md:pr-5 mr-5'
                } text-white/90`}
              >
                We aim to accelerate the development of a lunar base through better coordination.
                Want to help? Learn how to contribute to our mission, even if you're new to Web3,
                and get weekly updates.
              </p>
              <MailingList />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
