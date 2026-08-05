let activeLocks = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';
let previousBodyOverscroll = '';
let previousHtmlOverscroll = '';

const canUseDom = (): boolean => typeof document !== 'undefined';

export const acquireScrollLock = (): (() => void) => {
  if (!canUseDom()) return () => undefined;
  if (activeLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousBodyOverscroll = document.body.style.overscrollBehavior;
    previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
  }
  activeLocks += 1;
  document.documentElement.dataset.annwordScrollLocks = String(activeLocks);
  let released = false;
  return () => {
    if (released || !canUseDom()) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks > 0) {
      document.documentElement.dataset.annwordScrollLocks = String(activeLocks);
      return;
    }
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.body.style.overscrollBehavior = previousBodyOverscroll;
    document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    delete document.documentElement.dataset.annwordScrollLocks;
  };
};

export const resetScrollLocks = (): void => {
  if (!canUseDom()) return;
  activeLocks = 0;
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.overscrollBehavior = previousBodyOverscroll;
  document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
  delete document.documentElement.dataset.annwordScrollLocks;
};

export const getScrollLockCount = (): number => activeLocks;
