import { FormattedError } from './errorFormatter';

const ERROR_HISTORY_KEY = 'error_history';
const MAX_HISTORY_SIZE = 10;

export const saveErrorToHistory = (error: FormattedError): void => {
  try {
    const history = getErrorHistory();
    history.unshift(error);
    
    // Keep only last MAX_HISTORY_SIZE errors
    const trimmedHistory = history.slice(0, MAX_HISTORY_SIZE);
    
    localStorage.setItem(ERROR_HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (e) {
    console.warn('Failed to save error to history:', e);
  }
};

export const getErrorHistory = (): FormattedError[] => {
  try {
    const history = localStorage.getItem(ERROR_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.warn('Failed to load error history:', e);
    return [];
  }
};

export const clearErrorHistory = (): void => {
  try {
    localStorage.removeItem(ERROR_HISTORY_KEY);
  } catch (e) {
    console.warn('Failed to clear error history:', e);
  }
};

export const getErrorById = (id: string): FormattedError | undefined => {
  const history = getErrorHistory();
  return history.find(error => error.id === id);
};
