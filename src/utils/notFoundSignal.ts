// Tiny pub-sub so NotFound page can tell global overlays to stand down.
let isOn404 = false;
const listeners = new Set<(v: boolean) => void>();

export const setOn404 = (v: boolean) => {
  isOn404 = v;
  listeners.forEach((l) => l(v));
};

export const getOn404 = () => isOn404;

export const subscribeOn404 = (l: (v: boolean) => void) => {
  listeners.add(l);
  l(isOn404);
  return () => listeners.delete(l);
};
