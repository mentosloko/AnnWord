import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  chunkLoadError: boolean;
}

const CHUNK_RELOAD_GUARD_KEY = 'annword_chunk_reload_guard_v1';
const CHUNK_RELOAD_GUARD_TTL_MS = 60_000;

const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [^ ]+ failed|ChunkLoadError/i.test(message);
};

const shouldRetryChunkLoad = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const previous = Number(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || 0);
    const now = Date.now();
    if (Number.isFinite(previous) && previous > 0 && now - previous < CHUNK_RELOAD_GUARD_TTL_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now));
    return true;
  } catch {
    return true;
  }
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      chunkLoadError: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const chunkLoadError = isChunkLoadError(error);
    if (chunkLoadError) {
      return {
        hasError: true,
        chunkLoadError: true,
        errorMessage: 'Не удалось загрузить обновлённый раздел приложения.',
      };
    }

    let message = 'Произошла непредвиденная ошибка.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.operationType) {
        message = `Ошибка базы данных (${parsed.operationType}): ${parsed.error}`;
      }
    } catch {
      message = error.message;
    }
    return { hasError: true, errorMessage: message, chunkLoadError: false };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    if (isChunkLoadError(error) && shouldRetryChunkLoad()) {
      window.location.reload();
    }
  }

  public render() {
    const { hasError, errorMessage, chunkLoadError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Что-то пошло не так</h1>
            <p className="text-gray-600 mb-6">
              {chunkLoadError ? 'Приложение обновилось, а этот раздел не успел загрузить новую версию. Перезагрузите страницу и продолжайте с того же места.' : errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
