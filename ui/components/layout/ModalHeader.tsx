import { XMarkIcon } from '@heroicons/react/20/solid'
import { ReactNode } from 'react'

type ModalHeaderProps = {
  icon?: ReactNode
  title: string
  subtitle?: string
  onClose?: () => void
  setEnabled?: (enabled: boolean) => void
  dataTestId?: string
  className?: string
}

export default function ModalHeader({
  icon,
  title,
  subtitle,
  onClose,
  setEnabled,
  dataTestId = 'modal-header',
  className = '',
}: ModalHeaderProps) {
  const handleClose = () => {
    if (onClose) {
      onClose()
    } else if (setEnabled) {
      setEnabled(false)
    }
  }

  return (
    <div
      data-testid={dataTestId}
      className={`flex items-center justify-between p-6 border-b border-white/10 ${className}`}
    >
      <div className="flex items-center space-x-3">
        {icon && (
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
            {icon}
          </div>
        )}
        <div>
          <h2
            data-testid={`${dataTestId}-title`}
            className="text-xl font-semibold text-white"
          >
            {title}
          </h2>
          {subtitle && <p className="text-gray-300 text-sm">{subtitle}</p>}
        </div>
      </div>
      {(onClose || setEnabled) && (
        <button
          data-testid={`${dataTestId}-close`}
          id="close-modal"
          type="button"
          className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
          onClick={handleClose}
        >
          <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
        </button>
      )}
    </div>
  )
}

