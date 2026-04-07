import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    // @ts-ignore
    this.state = {
      hasError: false,
      errorMessage: ''
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    let message = "Произошла непредвиденная ошибка.";
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.operationType) {
        message = `Ошибка базы данных (${parsed.operationType}): ${parsed.error}`;
      }
    } catch {
      message = error.message;
    }
    return { hasError: true, errorMessage: message };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    // @ts-ignore
    const { hasError, errorMessage } = this.state;
    // @ts-ignore
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Что-то пошло не так</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
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
