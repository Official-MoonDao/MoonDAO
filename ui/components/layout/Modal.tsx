import { XMarkIcon } from '@heroicons/react/20/solid'
import { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Toaster } from 'react-hot-toast'
import { modalStyles } from '@/lib/layout/styles'
import { ModalSize, modalSizes } from '@/lib/layout/variants'

export interface ModalProps {
  id: string
  setEnabled: (enabled: boolean) => void
  children?: ReactNode
  className?: string
  size?: ModalSize
  title?: string
  showCloseButton?: boolean
  showToaster?: boolean
  onClose?: () => void
}

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export default function Modal({
  id,
  setEnabled,
  children,
  className,
  size = 'md',
  title,
  showCloseButton = true,
  showToaster = true,
  onClose,
}: ModalProps) {
  const handleClose = () => {
    if (onClose) {
      onClose()
    }
    setEnabled(false)
  }

  const sizeClass = modalSizes[size] || modalSizes.md
  const overlayClassName =
    className ||
    'fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-start z-[9999] overflow-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn'
  const contentClassName = className
    ? 'relative'
    : `${sizeClass} mx-auto ${modalStyles.base} relative`

  return (
    <Portal>
      <div
        onMouseDown={(e: any) => {
          e.stopPropagation()
          if (e.target.id === id) handleClose()
        }}
        id={id}
        className={overlayClassName}
      >
        {className ? (
          <div className={contentClassName}>
            {showCloseButton && !title && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-colors p-2"
                aria-label="Close modal"
                data-testid="modal-close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            )}
            <div>{children}</div>
          </div>
        ) : (
          <div className="mt-12 pb-12 w-full flex justify-center px-4">
            <div className={contentClassName}>
              {showCloseButton && !title && (
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-colors p-2"
                  aria-label="Close modal"
                  data-testid="modal-close"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              )}
              {title && (
                <div className="flex items-center justify-between p-6 border-b border-white/10 relative">
                  <h2 className="text-xl font-semibold text-white" data-testid="modal-title">
                    {title}
                  </h2>
                  {showCloseButton && (
                    <button
                      onClick={handleClose}
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label="Close modal"
                      data-testid="modal-close"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  )}
                </div>
              )}
              <div className={title || showCloseButton ? 'p-6' : ''}>{children}</div>
            </div>
          </div>
        )}
      </div>
      {showToaster && <Toaster />}
    </Portal>
  )
}
