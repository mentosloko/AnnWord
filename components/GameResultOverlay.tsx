import React from 'react';
import { CharacterProgressCard } from './CharacterProgressCard';

export const GameResultOverlay = (p: any) => {
  if (!p.isOpen) return null;
  const children = [
    React.createElement('h2', { key: 't' }, p.title),
    p.subtitle ? React.createElement('p', { key: 's' }, p.subtitle) : null,
    p.details ? React.createElement('div', { key: 'd' }, p.details) : null,
    p