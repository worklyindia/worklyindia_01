/// <reference types="vite/client" />
/// <reference types="node" />

interface Window {
  tidioChatApi?: {
    open: () => void;
    close: () => void;
    show: () => void;
    hide: () => void;
  };
  gc?: () => void;
}