import { useEffect } from 'react';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

export const useNativeKeyboard = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleKeyboardShow = (info: KeyboardInfo) => {
      console.log('⌨️ Keyboard shown:', info.keyboardHeight);
      document.body.classList.add('keyboard-open');
      
      // Scroll focused input into view
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    const handleKeyboardHide = () => {
      console.log('⌨️ Keyboard hidden');
      document.body.classList.remove('keyboard-open');
    };

    // Add keyboard event listeners
    Keyboard.addListener('keyboardWillShow', handleKeyboardShow);
    Keyboard.addListener('keyboardWillHide', handleKeyboardHide);

    // Configure keyboard behavior
    Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(console.warn);
    Keyboard.setScroll({ isDisabled: false }).catch(console.warn);

    return () => {
      Keyboard.removeAllListeners();
    };
  }, []);

  const hideKeyboard = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await Keyboard.hide();
    } catch (error) {
      console.warn('Failed to hide keyboard:', error);
    }
  };

  return { hideKeyboard };
};
