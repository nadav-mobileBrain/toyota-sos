import toast, { ToastOptions } from 'react-hot-toast';

export type ToastType = 'success' | 'error' | 'loading' | 'info' | 'warning';

interface ToastParams {
  message: string;
  type?: ToastType;
  duration?: number;
  options?: ToastOptions;
}

/**
 * Reusable toast utility with predefined types
 */
export const showToast = ({ message, type = 'info', duration, options }: ToastParams) => {
  const defaultOptions: ToastOptions = {
    duration: duration ?? (type === 'error' ? 5000 : 4000),
    position: 'top-center',
    ...options,
  };

  switch (type) {
    case 'success':
      return toast.success(message, defaultOptions);
    case 'error':
      return toast.error(message, defaultOptions);
    case 'loading':
      return toast.loading(message, defaultOptions);
    case 'warning':
      return toast(message, {
        ...defaultOptions,
        icon: '⚠️',
        style: {
          background: '#fbbf24',
          color: '#fff',
        },
      });
    case 'info':
    default:
      return toast(message, defaultOptions);
  }
};

/**
 * Convenience methods for each toast type
 */
export const toastSuccess = (message: string, duration?: number, options?: ToastOptions) =>
  showToast({ message, type: 'success', duration, options });

export const toastError = (message: string, duration?: number, options?: ToastOptions) =>
  showToast({ message, type: 'error', duration, options });

export const toastLoading = (message: string, duration?: number, options?: ToastOptions) =>
  showToast({ message, type: 'loading', duration, options });

export const toastInfo = (message: string, duration?: number, options?: ToastOptions) =>
  showToast({ message, type: 'info', duration, options });

export const toastWarning = (message: string, duration?: number, options?: ToastOptions) =>
  showToast({ message, type: 'warning', duration, options });

/**
 * Promise-based toast - automatically shows loading, then success/error
 */
export const toastPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: ToastOptions
) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    options
  );
};

export { toast };
export { Toaster } from 'react-hot-toast';

