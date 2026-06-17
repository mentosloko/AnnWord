import React from 'react';
import { PracticeHomeScreen } from './PracticeHomeScreen';

type Props = React.ComponentProps<typeof PracticeHomeScreen> & { onStartLetterSquare: () => void };

export const PracticeHomeScreenWithLetterSquare: React.FC<Props> = ({ onStartLetterSquare, ...props }) => <>
  <PracticeHomeScreen {...props} />
  <div className="mx-auto -mt-12 max-w-7xl px-4 pb-20 sm:px-6">
    <button type="button" onClick={onStartLetterSquare} className="w-full rounded-[1.75rem] border-2 border-blue-100 bg-blue-600 px-5 py-4 text-left font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-700 sm:max-w-sm">
      <span className="block text-xs uppercase tracking-widest text-white/70">Новая игра</span>
      <span className="mt-1 block text-2xl">Квадрат слов</span>
      <span className="mt-1 block text-sm text-white/80">Соединяйте буквы без диагоналей.</span>
    </button>
  </div>
</>;
