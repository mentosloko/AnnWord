import { useEffect } from 'react';
import { acquireScrollLock } from '../services/scrollLock';

export const useBodyScrollLock = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    return acquireScrollLock();
  }, [active]);
};
