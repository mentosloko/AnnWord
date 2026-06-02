import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-indigo-900">Правила AnnWord</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-5 text-gray-700">
          <section>
            <h4 className="font-black text-indigo-800 mb-2">Цель игры</h4>
            <p className="text-sm leading-relaxed">
              Угадайте английское слово за ограниченное число попыток. После каждой попытки игра показывает,
              какие буквы стоят на правильном месте, какие есть в слове, а каких в слове нет.
            </p>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-100 p-3">
              <div className="w-9 h-9 rounded-xl bg-green-500 text-white flex items-center justify-center font-black">A</div>
              <div>
                <div className="font-bold text-green-800">Зелёный</div>
                <div className="text-xs text-green-700">Буква есть в слове и стоит на правильном месте.</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-yellow-50 border border-yellow-100 p-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-500 text-white flex items-center justify-center font-black">B</div>
              <div>
                <div className="font-bold text-yellow-800">Жёлтый</div>
                <div className="text-xs text-yellow-700">Буква есть в слове, но стоит в другом месте.</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-3">
              <div className="w-9 h-9 rounded-xl bg-gray-400 text-white flex items-center justify-center font-black">C</div>
              <div>
                <div className="font-bold text-gray-800">Серый</div>
                <div className="text-xs text-gray-600">Такой буквы в слове нет.</div>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-black text-indigo-800 mb-2">Словарь</h4>
            <p className="text-sm leading-relaxed">
              Играйте со встроенным словарём или загрузите свои слова, чтобы потренировать их во всех режимах.
            </p>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full bg-indigo-600 text-white font-black py-3 rounded-2xl hover:bg-indigo-700 transition"
        >
          Понятно
        </button>
      </div>
    </div>
  );
};