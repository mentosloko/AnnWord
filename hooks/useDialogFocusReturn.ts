import { useEffect, useRef } from 'react';

const focusWhenReady = (element: HTMLElement | null): void => {
  if (!element?.isConnected) return;
  window.requestAnimationFrame(() => {
    if (element.isConnected) element.focus();
  });
};

/**
 * Remembers the element that opened a modal and restores focus after the modal closes.
 * The dialog itself remains responsible for its initial focus and focus trap.
 */
export const useDialogFocusReturn = (isOpen: boolean): void => {
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else if (!isOpen && wasOpenRef.current) {
      focusWhenReady(openerRef.current);
      openerRef.current = null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => () => {
    if (wasOpenRef.current) focusWhenReady(openerRef.current);
  }, []);
};
