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
  /** Center the title over a narrow centered tool (bridge, lock, buy). */
  centerHeader?: boolean
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
  centerHeader = false,
  align,
  toolbar,
  actions,
  back,
}) => {
  const resolvedAlign = align ?? (centerHeader ? 'center' : 'left')
  const showTitle = Boolean(
    (header != null && header !== '') || subHeader || description || toolbar || actions || back
  )
  const frameStyle = contentwide ? { width: '100%', maxWidth: '100%' } : { maxWidth }

  return (
    <div className="w-full min-w-0">
      {showTitle && (
        <section id="title-section" className="relative z-0">
          <div
            id="title-section-container"
            className="relative mx-auto w-full min-w-0 px-4 sm:px-5"
            style={frameStyle}
          >
            <div id="title" className="relative w-full min-w-0">
              <div id="content-container" className="w-full min-w-0">
                <PageHeader
                  title={header}
                  subHeader={subHeader}
                  description={description}
                  toolbar={toolbar}
                  actions={actions}
                  back={back}
                  align={resolvedAlign}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {children && (
        <section id="main-section-container" className="relative z-20">
          <div id="main-section" className="relative mx-auto w-full" style={frameStyle}>
            <div
              id="content"
              className={`relative z-50 w-full min-w-0 pb-8 ${contentwide ? '' : 'px-4 sm:px-5'}`}
            >
              {children}
            </div>
          </div>
        </section>
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
