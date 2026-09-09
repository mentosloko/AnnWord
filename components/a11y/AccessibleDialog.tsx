import React, { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface AccessibleDialogProps {
  open: boolean;
  titleId: string;
  descriptionId?: string;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
  onEscape?: () => void;
}

export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({ open, titleId, descriptionId, labelledBy, describedBy, className = '', overlayClassName = '', children, onEscape }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape?.();
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable: HTMLElement[] = Array.from(dialog.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
      const enabledFocusable = focusable.filter(item => !item.hasAttribute('disabled'));
      if (enabledFocusable.length === 0) return;
      const first = enabledFocusable[0];
      const last = enabledFocusable[enabledFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onEscape]);
  if (!open) return null;
  return <div className={`fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-indigo-950/55 backdrop-blur-sm ${overlayClassName}`} role="presentation">
    <div className="flex min-h-full items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId} aria-describedby={describedBy || descriptionId} tabIndex={-1} className={`outline-none ${className}`}>
        {children}
      </div>
    </div>
  </div>;
};