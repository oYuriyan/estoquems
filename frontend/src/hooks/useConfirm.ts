import { useState, useCallback } from 'react';
import type { ConfirmDialog } from '../types';

export function useConfirm() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, onConfirm });
  }, []);

  const dismissConfirm = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  return { confirmDialog, showConfirm, dismissConfirm };
}
