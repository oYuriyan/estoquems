import { toast } from 'sonner';

export function useToast() {
  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const dismissToast = (id: string | number) => {
    toast.dismiss(id);
  };

  // toasts array não é mais necessário controlar manualmente
  return { toasts: [], addToast, dismissToast };
}
