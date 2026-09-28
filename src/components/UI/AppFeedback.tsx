import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface AppToastProps {
  variant: 'success' | 'error';
  title: string;
  message: string;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const toastShell: Record<AppToastProps['variant'], string> = {
  success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200',
  error: 'bg-red-950/90 border-red-500/50 text-red-200',
};

const toastIcon: Record<AppToastProps['variant'], string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
};

const toastButton: Record<AppToastProps['variant'], string> = {
  success: 'text-emerald-400 hover:text-emerald-100',
  error: 'text-red-400 hover:text-red-100',
};

export const AppToast: React.FC<AppToastProps> = ({ variant, title, message, onClose, actionLabel, onAction }) => {
  const Icon = variant === 'success' ? CheckCircle : AlertCircle;
  return (
    <div
      role={variant === 'success' ? 'status' : 'alert'}
      className={`fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-3 right-3 sm:left-auto sm:right-4 z-50 max-w-md border p-3 sm:p-4 rounded-xl shadow-xl flex items-start gap-3 backdrop-blur-md transition-all ${toastShell[variant]}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${toastIcon[variant]}`} />
      <div className="text-xs space-y-1 min-w-0 flex-1">
        <p className="font-semibold font-code">{title}</p>
        <p className="leading-relaxed break-words">{message}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-code font-semibold ml-auto shrink-0 min-h-[32px] px-3 flex items-center rounded-md bg-white/10 border border-current/30 hover:bg-white/20 transition-all active:scale-95"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className={`text-xs font-code ml-auto shrink-0 min-h-[32px] px-2 flex items-center transition-all active:scale-95 ${toastButton[variant]}`}
      >
        Fechar
      </button>
    </div>
  );
};

export const AppLoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div
    role="status"
    aria-busy="true"
    aria-label={message}
    className="fixed inset-0 z-50 bg-[var(--bg-canvas)] flex flex-col"
  >
    {/* Fantasma do header do leitor */}
    <div className="h-14 shrink-0 border-b border-[var(--border-rule)] flex items-center justify-between px-2.5 sm:px-4" aria-hidden="true">
      <div className="flex items-center gap-1.5">
        <div className="h-10 w-10 rounded-md bg-[var(--bg-surface)] animate-pulse" />
        <div className="h-10 w-10 rounded-md bg-[var(--bg-surface)] animate-pulse" />
      </div>
      <div className="h-4 w-40 rounded bg-[var(--bg-surface)] animate-pulse" />
      <div className="flex items-center gap-1">
        <div className="h-10 w-10 rounded-md bg-[var(--bg-surface)] animate-pulse" />
        <div className="h-10 w-10 rounded-md bg-[var(--bg-surface)] animate-pulse" />
        <div className="h-10 w-10 rounded-md bg-[var(--bg-surface)] animate-pulse" />
      </div>
    </div>
    {/* Fantasma da coluna de leitura */}
    <div className="flex-1 min-h-0 overflow-hidden px-3.5 py-6 sm:px-8 sm:py-16" aria-hidden="true">
      <div className="mx-auto w-full max-w-[65ch] space-y-2.5">
        <div className="h-7 w-3/5 rounded bg-[var(--bg-surface)] animate-pulse" />
        <div className="h-4 w-2/5 rounded bg-[var(--bg-surface)] animate-pulse" />
        <div className="pt-4 space-y-2.5">
          <div className="h-3 w-full rounded bg-[var(--border-rule-subtle)] animate-pulse" />
          <div className="h-3 w-11/12 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
          <div className="h-3 w-full rounded bg-[var(--border-rule-subtle)] animate-pulse" />
          <div className="h-3 w-4/6 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
          <div className="h-3 w-full rounded bg-[var(--border-rule-subtle)] animate-pulse" />
          <div className="h-3 w-3/6 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
        </div>
      </div>
    </div>
    {/* Fantasma do footer do leitor */}
    <div className="h-12 shrink-0 border-t border-[var(--border-rule-subtle)] flex items-center justify-between px-3 sm:px-4" aria-hidden="true">
      <div className="h-10 w-24 rounded-md bg-[var(--bg-surface)] animate-pulse" />
      <div className="h-3 w-16 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
      <div className="h-10 w-24 rounded-md bg-[var(--bg-surface)] animate-pulse" />
    </div>
    <span className="sr-only">{message}</span>
  </div>
);

export const AppSuspenseFallback: React.FC = () => (
  <div
    role="status"
    aria-label="Carregando livro"
    className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-canvas)] px-6"
  >
    <div className="w-full max-w-[65ch] space-y-3" aria-hidden="true">
      <div className="h-6 w-2/5 rounded bg-[var(--bg-surface)] animate-pulse" />
      <div className="h-3 w-full rounded bg-[var(--border-rule-subtle)] animate-pulse" />
      <div className="h-3 w-11/12 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
      <div className="h-3 w-full rounded bg-[var(--border-rule-subtle)] animate-pulse" />
      <div className="h-3 w-3/6 rounded bg-[var(--border-rule-subtle)] animate-pulse" />
    </div>
    <span className="font-editorial text-sm text-[var(--text-muted)] mt-5">Carregando livro...</span>
  </div>
);
