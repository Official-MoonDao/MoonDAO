import React, { ReactNode } from 'react'
import PageHeader from './PageHeader'

interface ContentProps {
  titleSection?: ReactNode
  /** @deprecated Decorative header art was removed. */
  logo?: ReactNode
  header?: string | ReactNode
  subHeader?: string | ReactNode
  description?: ReactNode
  /** @deprecated Title size is set by PageHeader. */
  headerSize?: string
  children?: ReactNode
  preFooter?: ReactNode
  mainBgColor?: string
  mainPadding?: boolean
  /** @deprecated Layout is always compact. */
  mode?: 'compact' | 'default'
  /** @deprecated Overlap treatment was removed with the header art. */
  popOverEffect?: boolean
  contentwide?: boolean
  /** @deprecated Branded header art was removed. */
  branded?: boolean
  isProfile?: boolean
  maxWidth?: string
  /** @deprecated Titles stay left-aligned with the content column. */
  centerHeader?: boolean
  /** @deprecated Unused. The content column sets the width. */
  centerHeaderWidth?: string
  toolbar?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  align?: 'left' | 'center'
}

const ContentLayout: React.FC<ContentProps> = ({
  header,
  subHeader,
  description,
  children,
  preFooter,
  contentwide = false,
  maxWidth = '1200px',
  align = 'left',
  toolbar,
  actions,
  back,
}) => {
  const showTitle = Boolean(
    (header != null && header !== '') || subHeader || description || toolbar || actions || back
  )
  const showFrame = showTitle || Boolean(children)
  const frameStyle = contentwide ? { width: '100%', maxWidth: '100%' } : { maxWidth }

  return (
    <div className="w-full min-w-0">
      {showFrame && (
        <div className="mx-auto w-full min-w-0 px-4 sm:px-5" style={frameStyle}>
          {showTitle && (
            <section id="title-section" className="relative z-0">
              <div id="title-section-container" className="relative w-full min-w-0">
                <div id="title" className="relative w-full min-w-0">
                  <div id="content-container" className="w-full min-w-0">
                    <PageHeader
                      title={header}
                      subHeader={subHeader}
                      description={description}
                      toolbar={toolbar}
                      actions={actions}
                      back={back}
                      align={align}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {children && (
            <section id="main-section-container" className="relative z-20">
              <div id="main-section" className="relative w-full">
                <div id="content" className="relative z-50 w-full min-w-0 pb-8">
                  {children}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {preFooter && (
        <section id="preFooter-container-element" className="relative z-10">
          {preFooter}
        </section>
      )}
    </div>
  )
}

export default ContentLayout
