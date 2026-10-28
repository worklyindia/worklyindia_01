/**
 * File-picker guard
 * -----------------
 * On mobile (especially Android Chrome / PWA), opening the native file or
 * photo picker hides the page. When the user comes back, our
 * `visibilitychange` / `focus` self-heal handlers fire and re-validate the
 * session + refetch profiles. That re-render cascade can unmount the page the
 * user was on, which silently throws away the just-picked image — the user
 * sees the page "refresh" and the crop dialog never appears.
 *
 * This module exposes a tiny global flag: while a file picker is open (and for
 * a short grace period after returning) wake-up refetches are suspended so the
 * page that owns the file input stays mounted.
 */

let pickerOpen = false;
let suspendUntil = 0;
let installed = false;

// Never suspend forever — if the user abandons the picker we still want the
// normal self-heal behaviour back.
const MAX_PICKER_MS = 120_000;
const GRACE_AFTER_RETURN_MS = 4_000;

const isFileInput = (el: EventTarget | null): el is HTMLInputElement =>
  el instanceof HTMLInputElement && el.type === "file";

/** Call right before programmatically opening a file picker. */
export const markFilePickerOpen = () => {
  pickerOpen = true;
  suspendUntil = Date.now() + MAX_PICKER_MS;
};

/** Call once the picker has closed (file chosen or cancelled). */
export const markFilePickerClosed = () => {
  pickerOpen = false;
  suspendUntil = Date.now() + GRACE_AFTER_RETURN_MS;
};

/** True while a file picker is open or just closed. */
export const isFilePickerSuspended = () => pickerOpen || Date.now() < suspendUntil;

/** Install global listeners (idempotent). */
export const installFilePickerGuard = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;

  // Any click on a file input opens the native picker.
  document.addEventListener(
    "click",
    (e) => {
      if (isFileInput(e.target)) markFilePickerOpen();
    },
    true
  );

  document.addEventListener(
    "change",
    (e) => {
      if (isFileInput(e.target)) markFilePickerClosed();
    },
    true
  );

  // Returning from the picker (with or without a file) refocuses the window.
  window.addEventListener("focus", () => {
    if (pickerOpen) markFilePickerClosed();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && pickerOpen) markFilePickerClosed();
  });
};
