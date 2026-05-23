import { useState, useCallback } from 'react';

export function useDialog() {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setDialog({ type: 'confirm', message, resolve });
    });
  }, []);

  const alert = useCallback((message) => {
    return new Promise((resolve) => {
      setDialog({ type: 'alert', message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setDialog(prev => { prev?.resolve(true); return null; });
  }, []);

  const handleCancel = useCallback(() => {
    setDialog(prev => { prev?.resolve(false); return null; });
  }, []);

  return { dialog, confirm, alert, handleConfirm, handleCancel };
}