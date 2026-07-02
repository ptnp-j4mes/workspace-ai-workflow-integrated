// ============================================================
// Shared Toast Utility (react-toastify)
// ============================================================
// Usage:
//   import { toast } from '@/lib/toast'
//   toast.success('Saved!', 'Your changes have been saved.')
//   toast.error('Failed', 'Something went wrong.')
//   toast.warning('Warning', 'Please check your input.')
//   toast.info('Info', 'Data refreshed.')
//   toast('Simple message')  // default type

import { toast as toastify, type ToastContent, type ToastOptions } from 'react-toastify'

// ============================================================
// Default options
// ============================================================

const defaultOptions: ToastOptions = {
  position: 'bottom-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'light',
}

// ============================================================
// Toast type options (icon + style per context)
// ============================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default'

interface ToastCallOptions extends ToastOptions {
  /** Toast variant type — determines icon and accent color */
  type?: ToastType
}

// ============================================================
// Convenience API
// ============================================================

interface ToastFn {
  (content: ToastContent, options?: ToastCallOptions): ReturnType<typeof toastify>
  success: (title: string, description?: string, options?: ToastCallOptions) => ReturnType<typeof toastify>
  error: (title: string, description?: string, options?: ToastCallOptions) => ReturnType<typeof toastify>
  warning: (title: string, description?: string, options?: ToastCallOptions) => ReturnType<typeof toastify>
  info: (title: string, description?: string, options?: ToastCallOptions) => ReturnType<typeof toastify>
  dismiss: (id?: string | number) => void
}

function createContent(title: string, description?: string): ToastContent {
  if (!description) {
    return (
      <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.4' }}>{title}</span>
    ) as ToastContent
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.4' }}>{title}</span>
      <span style={{ fontSize: '12px', lineHeight: '1.4', opacity: 0.65 }}>{description}</span>
    </div>
  ) as ToastContent
}

const sharedToast: ToastFn = Object.assign(
  (content: ToastContent, options?: ToastCallOptions) => {
    const { type, ...rest } = options || {}
    return toastify(content, { ...defaultOptions, type: type === 'default' ? undefined : type, ...rest })
  },
  {
    success: (title: string, description?: string, options?: ToastCallOptions) => {
      return toastify.success(createContent(title, description), { ...defaultOptions, ...options })
    },
    error: (title: string, description?: string, options?: ToastCallOptions) => {
      return toastify.error(createContent(title, description), { ...defaultOptions, ...options })
    },
    warning: (title: string, description?: string, options?: ToastCallOptions) => {
      return toastify.warning(createContent(title, description), { ...defaultOptions, ...options })
    },
    info: (title: string, description?: string, options?: ToastCallOptions) => {
      return toastify.info(createContent(title, description), { ...defaultOptions, ...options })
    },
    dismiss: (id?: string | number) => {
      toastify.dismiss(id)
    },
  }
)

export { sharedToast as toast }
export type { ToastType, ToastCallOptions }
