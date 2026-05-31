export interface MoodDisplay {
  label: 'Грусть' | 'Спокойный' | 'Радость';
  barClass: string;
  trackClass: string;
  textClass: string;
  textOnDarkClass: string;
}

export const getMoodDisplay = (score: number): MoodDisplay => {
  if (score <= 33) {
    return {
      label: 'Грусть',
      barClass: 'bg-red-400',
      trackClass: 'bg-red-50',
      textClass: 'text-red-600',
      textOnDarkClass: 'text-red-100',
    };
  }

  if (score <= 66) {
    return {
      label: 'Спокойный',
      barClass: 'bg-yellow-400',
      trackClass: 'bg-yellow-50',
      textClass: 'text-yellow-700',
      textOnDarkClass: 'text-yellow-100',
    };
  }

  return {
    label: 'Радость',
    barClass: 'bg-green-400',
    trackClass: 'bg-green-50',
    textClass: 'text-green-600',
    textOnDarkClass: 'text-green-100',
  };
};
