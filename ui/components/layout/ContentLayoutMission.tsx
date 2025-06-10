import React, { ReactNode } from 'react'
import Frame from './Frame'
import PreFooter from './PreFooter'
import Image from 'next/image'

interface ContentProps {
  titleSection?: ReactNode
  header?: string
  subHeader?: string
  description?: any
  headerSize?: string
  children?: ReactNode
  preFooter?: ReactNode
  mainBgColor?: string
  mainPadding?: boolean
  mode?: 'compact' | 'default'
  popOverEffect?: boolean
  contentwide?: boolean
  branded?: boolean
  isProfile?: boolean
}

const ContentLayout: React.FC<ContentProps> = ({
  titleSection,
  header,
  subHeader,
  description,
  headerSize,
  children,
  preFooter,
  mainBgColor = 'dark-cool',
  mainPadding,
  mode = 'default',
  popOverEffect = false,
  contentwide = false,
  branded = true,
  isProfile = false,
}) => {
  const isCompact = mode === 'compact'

  return (
    <div className="">
      <section id="title-section" className="z-0 relative bg-black">
        <div className="absolute inset-0 w-full h-full overflow-hidden">
        </div>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#3E3DA2] from-0% to-[#020617] to-80%"></div>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent from-90% sm:from-40% lg:from-80% to-[#090d21] to-90% sm:to-40% lg:to-80%"></div>
        <div id="title-section-container">
          <div id="title" className="relative z-10 flex items-center xl:justify-center">
            <div
              id="content-container"
              className={`
                                flex flex-col h-full relative max-w-[1200px]
                                ${
                                  isCompact ? '' : 'lg:flex-row lg:items-start'
                                } 
                            `}
            >
              <div
                id="image-container"
                className="w-full h-full relative left-[-1px]"
              >
              </div>
              <div
                id="title-wrapper"
                className={`
                                    z-50 w-full overflow-x-hidden pt-0
                                    ${
                                      isCompact
                                        ? ''
                                        : 'lg:ml-[-10vw] lg:mt-0 md:p-10 md:pb-5'
                                    } 
                                    ${
                                      children
                                        ? 'pb-0 md:pb-[30px] lg:pb-[120px]'
                                        : 'flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]'
                                    }
                                    ${isProfile ? 'lg:mb-[-100px]' : ''}
                                `}
                >
                <div
                  id="title-container"
                  className={`
                                        w-full h-full
                                        ${
                                          isCompact
                                            ? ''
                                            : 'md:max-w-[700px] lg:max-w-[100%]'
                                        }
                                    `}
                  >
                  <h1
                    id="header-element"
                    className={`
                                            w-full leading-[1] font-GoodTimes 
                                            ${isCompact ? 'pt-0' : 'lg:pt-20'} 
                                        `}
                    style={{ fontSize: headerSize || 'max(25px, 4vw)' }}
                  >
                    {header}
                  </h1>

                  {subHeader && (
                    <h2 id="sub-header" className="sub-header">
                      {subHeader}
                    </h2>
                  )}
                  <div
                    className={`
                                            pt-2 pb-2 lg:max-w-[1200px]
                                            ${
                                              isCompact
                                                ? 'pb-0 w-full'
                                                : 'pb-5 md:pb-20 lg:pb-15 '
                                            } 
                                            ${branded ? '' : 'mt-20'}
                                        `}
                  >
                    {description && <span>{description}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {children && (
        <section id="main-section-container" className="w-full h-full flex justify-center">
          <div
            id="main-section"
            className={`
                        relative w-full mt-0 
                        ${mainPadding ? 'p-0' : 'pb-5'} 
                        ${
                          isCompact && !isProfile
                            ? 'mt-0 md:mt-[-120px] lg:mt-[-200px]'
                            : isCompact && isProfile
                            ? ''
                            : 'mt-0 md:mt-[-200px] lg:mt-[-280px] md:pb-0 '
                        }
                    `}
          >
            {popOverEffect ? null : (
              <div
                id="popout-bg-element"
                className={`
                                z-0  absolute w-full md:w-[calc(100%-40px)] lg:w-[calc(100%-100px)] 2xl:w-full left-0 md:left-[50px] lg:left-[100px] 2xl:left-[150px] rounded-bl-[20px] 
                                ${
                                  !isProfile
                                    ? `h-[calc(100%-200px)] top-[200px]`
                                    : 'h-full top-0'
                                }
                                `}
              ></div>
            )}
            <div
              id="main-section-content-container"
              className={`relative z-10 
                            ${
                              isCompact && !popOverEffect
                                ? 'md:ml-0'
                                : 'md:m-10'
                            } 
                            ${
                              isCompact && popOverEffect ? 'md:ml-0' : 'md:m-0'
                            } 
                            ${popOverEffect ? ' pb-0 mb-0 md:mb-[-160px]' : ''} 
                            ${contentwide ? 'p-0' : ''}
                        `}
            >
              <div className="overflow-hidden">
                <div id="content">
                  <div className="">{children}</div>
                </div>
              </div>
            </div>
          </div>
          {preFooter && (
            <div
              id="spacer"
              className={`bg-white rounded-tl-[5vmax] w-full h-[5vh] md:h-[200px] 
                        ${popOverEffect ? '' : 'hidden'}
                    `}
            ></div>
          )}
        </section>
      )}

      {preFooter && (
        <section id="preFooter-container-element">{preFooter}</section>
      )}
    </div>
  )
}

export default ContentLayout
