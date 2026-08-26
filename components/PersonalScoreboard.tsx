import React from 'react';
import { rankPersonalScores, readPersonalScores, recordPersonalScore, ScoreDirection } from '../services/personalScoreboard';
import { inflectRussianUnit } from '../utils/textUtils';

interface PersonalScoreboardProps {
  gameId: string;
  userKey: string;
  value: number;
  direction: ScoreDirection;
  unit: string;
  record?: boolean;
}

export const PersonalScoreboard: React.FC<PersonalScoreboardProps> = ({
  gameId,
  userKey,
  value,
  direction,
  unit,
  record = true,
}) => {
  const safeValue = Math.max(0, Math.round(value || 0));
  const [scores] = React.useState(() => record
    ? recordPersonalScore(userKey, gameId, safeValue, direction)
    : rankPersonalScores(readPersonalScores(userKey, gameId), direction));
  const top = scores.slice(0, 5);
  const rank = record ? scores.findIndex(entry => entry.value === safeValue) + 1 : 0;
  const displayedUnit = inflectRussianUnit(safeValue, unit);

  return <section className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4 text-left shadow-sm" aria-label="Личный скорборд">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-indigo-300">Личный скорборд</div>
        <div className="mt-1 font-black text-indigo-950">Результат: {safeValue} {displayedUnit}</div>
      </div>
      {rank > 0 && <div className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-black text-indigo-700">#{rank}</div>}
    </div>
    {top.length > 0 ? <div className="mt-3 grid grid-cols-5 gap-1.5">
      {top.map((entry, index) => <div key={`${entry.recordedAt}-${index}`} className={`rounded-xl px-2 py-2 text-center ${record && entry.value === safeValue && index === rank - 1 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800'}`}>
        <div className="text-[10px] font-black opacity-60">{index + 1}</div>
        <div className="text-sm font-black">{entry.value}</div>
      </div>)}
    </div> : <p className="mt-2 text-xs font-bold text-slate-400">Первый результат появится после успешного завершения игры.</p>}
    {!record && <p className="mt-2 text-xs font-bold text-slate-400">Текущий результат не добавлен: в скорборд входят успешные завершения.</p>}
  </section>;
};
