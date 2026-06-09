import React from 'react';

export const FamilySetupScreen: React.FC<any> = ({ onBackHome }) => (
  <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
    <h1 className="text-2xl font-black text-indigo-950">Family setup</h1>
    <p className="mt-3 text-sm font-semibold text-gray-600">One premium seat is used for one child. Add another child from the parent cabinet after buying another premium seat.</p>
    <button type="button" onClick={onBackHome} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">Back</button>
