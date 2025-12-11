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
      <section id="title-section" className="z-0 relative">
        <div id="title-section-container" className="relative">
          <div id="title" className="relative z-0">
            <div id="graphic-element-container" className="relative overflow-hidden">
              <div
                id="graphic-element"
                className="w-full h-full absolute top-0 left-0 bg-gradient-to-br from-gray-900/80 via-blue-900/40 to-purple-900/30 backdrop-blur-xl border-b border-white/10 rounded-b-3xl shadow-2xl"
              ></div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none"></div>
            </div>
            <div
              id="content-container"
              className={`
                                flex flex-col h-full relative max-w-[1200px] mx-auto
                                ${isCompact ? '' : 'lg:flex-row lg:items-start'} 
                            `}
            >
              <div id="image-container" className="w-full h-full relative mb-10 z-10">
                {logo ? (
                  <div
                    id="logo"
                    className={`
                    ${branded ? 'min-h-[200px]' : 'absolute min-h-[350px] min-w-[350px]'} 
                    ${isCompact ? '' : 'md:min-h-[200px] lg:min-h-[600px] md:min-w-[450px]'}`}
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
                                        ? isProfile
                                          ? 'pl-5'
                                          : 'pl-[25px]'
                                        : 'lg:ml-[-10vw] lg:mt-0 md:p-10 md:pb-5'
                                    } 
                                    ${
                                      children
                                        ? `pb-0 ${
                                            isCompact && isProfile ? 'md:pb-4' : 'md:pb-[30px]'
                                          } ${popOverEffect ? 'lg:pb-[170px]' : 'lg:pb-[120px]'}`
                                        : 'flex md:items-start lg:items-center min-h-[60vh] lg:min-h-[90vh]'
                                    }
                                    ${isProfile ? 'lg:mb-[-100px]' : ''}
                                `}
              >
                <div
                  id="title-container"
                  className={`
                                        p-5 pl-0 pb-5 md:pb-0 w-full h-full 
                                        ${isCompact ? '' : 'md:max-w-[700px] lg:max-w-[100%]'}
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
                                              isCompact ? 'pb-0 w-full' : 'pb-5 md:pb-20 lg:pb-15 '
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
        <section id="main-section-container" className="relative">
          <div
            id="main-section"
            className={`
                        relative w-full ${
                          contentwide || (isCompact && isProfile) ? 'max-w-full' : 'max-w-[1200px]'
                        } ${contentwide || (isCompact && isProfile) ? '' : 'mx-auto'} mt-0 
                        ${mainPadding || contentwide || (isCompact && isProfile) ? 'p-0' : 'pb-5'} 
                        ${
                          isCompact && !isProfile
                            ? 'mt-0 md:mt-[-120px] lg:mt-[-200px]'
                            : isCompact && isProfile
                            ? ''
                            : 'mt-0 md:mt-[-200px] lg:mt-[-280px] md:pb-0 '
                        }
                    `}
            style={
              isCompact && isProfile
                ? { width: '100%', maxWidth: '100%' }
                : contentwide
                ? { width: '100%', maxWidth: '100%' }
                : undefined
            }
          >
            <div
              id="main-section-content-container"
              className={`relative z-10 w-full
                            ${
                              contentwide || (isCompact && isProfile)
                                ? 'm-0 p-0'
                                : isCompact && !popOverEffect
                                ? isProfile
                                  ? ''
                                  : 'md:ml-0'
                                : 'md:m-10'
                            } 
                            ${
                              isCompact &&
                              popOverEffect &&
                              !contentwide &&
                              !(isCompact && isProfile)
                                ? 'md:ml-0'
                                : ''
                            } 
                            ${popOverEffect ? ' pb-0 mb-0 md:mb-[-160px]' : ''}
                        `}
              style={
                isCompact && isProfile
                  ? {
                      width: '100%',
                      maxWidth: '100%',
                      marginLeft: 0,
                      marginRight: 0,
                      marginTop: 0,
                      marginBottom: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                    }
                  : contentwide
                  ? {
                      width: '100%',
                      maxWidth: '100%',
                      marginLeft: 0,
                      marginRight: 0,
                      marginTop: 0,
                      marginBottom: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                    }
                  : undefined
              }
            >
              <div
                className={`w-full ${
                  isCompact && isProfile ? 'overflow-visible' : 'overflow-hidden'
                }`}
              >
                <div
                  id="content"
                  className={`relative z-50 w-full
                                    ${
                                      contentwide || (isCompact && isProfile)
                                        ? 'm-0 p-0'
                                        : isCompact && !isProfile
                                        ? 'md:m-10 md:p-8'
                                        : isCompact
                                        ? 'md:m-0 md:mt-5 md:px-5'
                                        : 'm-5'
                                    }
                                `}
                  style={
                    isCompact && isProfile
                      ? { width: '100%', maxWidth: '100%', margin: 0, padding: 0 }
                      : contentwide
                      ? { width: '100%', maxWidth: '100%', margin: 0, padding: 0 }
                      : undefined
                  }
                >
                  <div
                    className={`relative z-50 w-full`}
                    style={
                      isCompact && isProfile
                        ? { width: '100%', maxWidth: '100%' }
                        : contentwide
                        ? { width: '100%', maxWidth: '100%' }
                        : undefined
                    }
                  >
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {preFooter && (
            <div
              id="spacer"
              className={`bg-gradient-to-b from-slate-900/90 to-white rounded-tl-3xl w-full h-[5vh] md:h-[200px] backdrop-blur-sm
                        ${popOverEffect ? '' : 'hidden'}
                    `}
            ></div>
          )}
        </section>
      )}

      {preFooter && <section id="preFooter-container-element">{preFooter}</section>}
    </div>
  )
}

export default ContentLayout
