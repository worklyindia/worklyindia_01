import { useState, useEffect } from 'react';
import { FormattedError } from '@/utils/errorFormatter';
import { getErrorHistory, clearErrorHistory, saveErrorToHistory } from '@/utils/errorStorage';

export const useErrorHistory = () => {
  const [history, setHistory] = useState<FormattedError[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const storedHistory = getErrorHistory();
    setHistory(storedHistory);
  };

  const addError = (error: FormattedError) => {
    saveErrorToHistory(error);
    loadHistory();
  };

  const clear = () => {
    clearErrorHistory();
    setHistory([]);
  };

  return {
    history,
    addError,
    clear,
    refresh: loadHistory,
  };
};
