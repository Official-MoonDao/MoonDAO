import toast from 'react-hot-toast'

const defaultToastStyle = {
  background: '#1a1a2e',
  color: '#fff',
  borderRadius: '8px',
  padding: '12px 16px',
}

export const toastUtils = {
  success: (message: string, options?: { duration?: number; style?: any }) => {
    return toast.success(message, {
      duration: options?.duration || 3000,
      style: options?.style || defaultToastStyle,
    })
  },
  error: (message: string, options?: { duration?: number; style?: any }) => {
    return toast.error(message, {
      duration: options?.duration || 5000,
      style: options?.style || defaultToastStyle,
    })
  },
  loading: (message: string, options?: { duration?: number; style?: any }) => {
    return toast.loading(message, {
      duration: options?.duration || Infinity,
      style: options?.style || defaultToastStyle,
    })
  },
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId)
  },
}

