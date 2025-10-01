import React, { ReactNode } from 'react'
import Frame from './Frame'
import PreFooter from './PreFooter'

interface ContentProps {
  titleSection?: ReactNode
  logo?: ReactNode
  header?: string | ReactNode
  subHeader?: string | ReactNode
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
  logo,
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
      <section id="title-section" className="z-0">
        <div id="title-section-container">
          <div id="title" className="relative z-0">
            <div id="graphic-element-container">
              <div
                id="graphic-element"
                className="gradient-10 w-full h-full rounded-bl-[2vmax] md:rounded-bl-[1vmax] md:rounded-bl-[2vmax] absolute top-0 left-0"
              ></div>
            </div>
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
                className="w-full h-full relative left-[-1px] mb-10"
              >
                {logo ? (
                  <div
                    id="logo"
                    className={`
                    ${
                      branded
                        ? 'min-h-[200px]'
                        : 'absolute min-h-[350px] min-w-[350px]'
                    } 
                    ${
                      isCompact
                        ? ''
                        : 'md:min-h-[200px] lg:min-h-[600px] md:min-w-[450px]'
                    }`}
                  >
                    {logo}
                  </div>
                ) : (
                  <div
                    id="image"
                    className={`
                                    ${
                                      branded
                                        ? 'branded min-h-[200px]'
                                        : 'absolute unbranded min-h-[350px] min-w-[350px]'
                                    } 
                                    ${
                                      isCompact
                                        ? ''
                                        : 'md:min-h-[200px] lg:min-h-[600px] md:min-w-[450px]'
                                    }`}
                  ></div>
                )}
              </div>
              <div
                id="title-wrapper"
                className={`
                                    z-50 w-full overflow-x-hidden p-5 pt-0 mt-[-80px]
                                    ${
                                      isCompact
                                        ? 'pl-[25px]'
                                        : 'lg:ml-[-10vw] lg:mt-0 md:p-10 md:pb-5'
                                    } 
                                    ${
                                      children
                                        ? `pb-0 md:pb-[30px] ${
                                            popOverEffect
                                              ? 'lg:pb-[170px]'
                                              : 'lg:pb-[120px]'
                                          }`
                                        : 'flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]'
                                    }
                                    ${isProfile ? 'lg:mb-[-100px]' : ''}
                                `}
              >
                <div
                  id="title-container"
                  className={`
                                        p-5 pl-0 pb-5 md:pb-0 w-full h-full 
                                        ${
                                          isCompact
                                            ? ''
                                            : 'md:max-w-[700px] lg:max-w-[100%]'
                                        }
                                    `}
                >
                  <div
                    id="header-element"
                    className={`header-responsive w-full max-w-[1200px] leading-[1] font-GoodTimes ${
                      isCompact ? 'pt-0' : 'lg:pt-20'
                    }`}
                  >
                    {header}
                  </div>

                  {subHeader && (
                    <div id="sub-header" className="sub-header">
                      {subHeader}
                    </div>
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
        <section id="main-section-container" className="">
          <div
            id="main-section"
            className={`
                        relative w-full max-w-[1200px] mt-0 
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
                <div
                  id="content"
                  className={` z-50
                                    ${
                                      isCompact && !isProfile
                                        ? 'md:m-10'
                                        : isCompact
                                        ? 'md:m-0 md:mt-5 md:mr-5'
                                        : 'm-5'
                                    }
                                `}
                >
                  <div className="md:ml-5 z-50">{children}</div>
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
