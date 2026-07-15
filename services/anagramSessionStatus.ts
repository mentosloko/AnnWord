type SavedAnagramSession = {
  solvedCount?: number;
  skippedCount?: number;
  activeWord?: string;
};

const keys = (username: string): string[] => {
  const owner = username || 'guest';
  return [
    `annword:active-anagram-session:v3:${owner}`,
    `annword:active-anagram-session:v2:${owner}`,
    `annword:active-anagram-session:v1:${owner}`,
  ];
};

const read = (key: string): SavedAnagramSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as SavedAnagramSession : null;
  } catch {
    return null;
  }
};

export const hasSavedAnagramSession = (username: string): boolean => keys(username).some(key => {
  const session = read(key);
  return Boolean(session?.activeWord) || Number(session?.solvedCount || 0) > 0 || Number(session?.skippedCount || 0) > 0;
});
