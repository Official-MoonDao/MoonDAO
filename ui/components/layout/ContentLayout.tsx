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
  maxWidth?: string
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
  maxWidth = '1200px',
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
                className="w-full h-full absolute top-0 left-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,200,0.03) 0%, rgba(5,5,8,0.9) 40%, rgba(10,15,18,0.8) 100%)',
                  borderBottom: '1px solid rgba(0, 255, 200, 0.1)',
                  contain: 'paint',
                }}
              ></div>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, transparent 60%, rgba(5,5,5,0.5) 100%)',
                }}
              ></div>
            </div>
            <div
              id="content-container"
              className={`
                                flex flex-col h-full relative mx-auto
                                ${isCompact ? '' : 'lg:flex-row lg:items-start'} 
                            `}
              style={{ maxWidth }}
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
                                    z-50 w-full overflow-x-hidden pt-0 mt-[-80px]
                                    ${
                                      isCompact
                                        ? isProfile
                                          ? 'px-4 sm:px-5 md:px-0'
                                          : 'px-2 sm:px-5'
                                        : 'lg:ml-[-10vw] lg:mt-0 md:p-10 md:pb-5 px-2 sm:px-5'
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
                                        flex flex-col pb-5 md:pb-0 w-full h-full 
                                        ${isCompact ? '' : 'md:max-w-[700px] lg:max-w-[100%]'}
                                    `}
                >
                  <div
                    id="header-element"
                    className={`block w-full max-w-[1200px] header-responsive leading-[1] font-GoodTimes ${
                      isCompact ? 'pt-0' : 'lg:pt-20'
                    }`}
                    style={{
                      color: '#00ffc8',
                      textShadow: '0 0 20px rgba(0, 255, 200, 0.3), 0 0 40px rgba(0, 255, 200, 0.1)',
                    }}
                  >
                    {header}
                  </div>

                  {subHeader && (
                    <div
                      id="sub-header"
                      className="block w-full sub-header"
                      style={{
                        color: '#b0ffe0',
                        fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                      }}
                    >
                      {subHeader}
                    </div>
                  )}
                  {description && (
                    <div
                      className={`
                                            block w-full mt-4 pt-2 pb-2
                                            ${isCompact ? 'pb-0' : 'pb-5 md:pb-20 lg:pb-15 '} 
                                            ${branded ? 'md:mt-2' : 'md:mt-20'}
                                        `}
                    >
                      <div className="block w-full" style={{ color: '#e0fff0', fontSize: '17px', lineHeight: '1.7', fontFamily: '"Rajdhani", "Helvetica Neue", sans-serif', fontWeight: 500, letterSpacing: '0.02em' }}>{description}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {children && (
        <section id="main-section-container" className="relative z-20">
          <div
            id="main-section"
            className={`
                        relative w-full ${
                          contentwide ? 'max-w-full' : ''
                        } ${contentwide ? '' : 'mx-auto'} mt-0 
                        ${mainPadding || contentwide ? 'p-0' : 'pb-5'} 
                        ${
                          isCompact && !isProfile
                            ? 'mt-0 md:mt-[-120px] lg:mt-[-200px]'
                            : isCompact && isProfile
                            ? 'mt-6 md:mt-0'
                            : 'mt-0 md:mt-[-200px] lg:mt-[-280px] md:pb-0 '
                        }
                    `}
            style={
              contentwide
                ? { width: '100%', maxWidth: '100%' }
                : { maxWidth }
            }
          >
            <div
              id="main-section-content-container"
              className={`relative z-10 w-full
                            ${
                              contentwide
                                ? 'm-0 p-0'
                                : isCompact && !popOverEffect
                                ? 'md:ml-0'
                                : isCompact && popOverEffect
                                ? 'md:ml-0'
                                : 'md:m-10'
                            } 
                            ${popOverEffect ? ' pb-0 mb-0 md:mb-[-160px]' : ''}
                        `}
              style={
                contentwide
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
                  contentwide || isProfile ? 'overflow-visible' : 'overflow-hidden'
                }`}
              >
                <div
                  id="content"
                  className={`relative z-50 w-full
                                    ${
                                      contentwide
                                        ? 'm-0 p-0'
                                        : isCompact
                                        ? ''
                                        : 'm-5'
                                    }
                                `}
                  style={
                    contentwide
                      ? { width: '100%', maxWidth: '100%', margin: 0, padding: 0 }
                      : undefined
                  }
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
          {preFooter && (
            <div
              id="spacer"
              className={`w-full h-[5vh] md:h-[200px]
                        ${popOverEffect ? '' : 'hidden'}
                    `}
              style={{
                background: 'linear-gradient(to bottom, rgba(10,15,18,0.9), rgba(5,5,5,0.5))',
                borderTop: '1px solid rgba(0, 255, 200, 0.05)',
              }}
            ></div>
          )}
        </section>
      )}

      {preFooter && <section id="preFooter-container-element" className="relative z-10">{preFooter}</section>}
    </div>
  )
}

export default ContentLayout
