import React from 'react';
import { ScreenContainer } from '../layout/ScreenContainer';

interface GameModeShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBackHome: () => void;
}

export const GameModeShell: React.FC<GameModeShellProps> = ({ title, subtitle, children, onBackHome }) => {
  return (
    <ScreenContainer className="pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={onBackHome}
          className="w-fit rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
        >
          ← На главный экран
        </button>
        <div className="sm:text-right">
          {subtitle && <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">{subtitle}</div>}
          <h1 className="text-3xl font-black text-indigo-950">{title}</h1>
        </div>
      </div>

      <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-4 sm:p-6">
        {children}
      </div>
    </ScreenContainer>
  );
};
