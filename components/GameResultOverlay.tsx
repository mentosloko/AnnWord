import React from 'react';

export const GameResultOverlay = (p: any) => {
  if (!p.isOpen) return null;
  return React.createElement('div', { className: 'fixed inset-0 z-[80] flex items-center justify-center bg-indigo-950/45 px-3 py-4 backdrop-blur-sm sm:px-4' },
    React.createElement('div', { role: 'dialog', 'aria-modal': true, className: 'max-h-[92vh] w-full max-w-[min(32rem,94vw)] overflow-y-auto rounded