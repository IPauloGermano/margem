import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Erro não tratado capturado:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="font-editorial text-2xl font-normal text-[var(--text-primary)] mb-2">
            Algo deu errado ao exibir esta tela
          </h2>

          <p className="font-code text-xs text-[var(--text-secondary)] max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || 'Ocorreu um erro inesperado durante a renderização.'}
          </p>

          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent-signal)] text-white px-5 py-2.5 font-code text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Voltar à Estante</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
