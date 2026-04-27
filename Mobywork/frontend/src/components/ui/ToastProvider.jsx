import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle2 size={16} />,
  error:   <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info:    <Info size={16} />,
};

const COLORS = {
  success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', icon: '#10b981', bar: '#10b981' },
  error:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  icon: '#ef4444', bar: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', icon: '#f59e0b', bar: '#f59e0b' },
  info:    { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', icon: '#3b82f6', bar: '#3b82f6' },
};

function Toast({ id, type = 'info', title, message, duration = 4000, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const c = COLORS[type] || COLORS.info;

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(id), 280);
  };

  React.useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      background: 'var(--bg-surface)', border: `1px solid ${c.border}`,
      borderLeft: `3px solid ${c.bar}`,
      borderRadius: 12, padding: '0.875rem 1rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', width: '340px', maxWidth: '90vw',
      position: 'relative', overflow: 'hidden',
      animation: exiting ? 'toast-out 0.28s ease forwards' : 'toast-in 0.28s ease',
    }}>
      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        height: 2, background: c.bar, opacity: 0.4,
        animation: `toast-progress ${duration}ms linear forwards`,
        width: '100%',
      }} />

      <div style={{ color: c.icon, flexShrink: 0, marginTop: '1px' }}>{ICONS[type]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: message ? '0.2rem' : 0 }}>{title}</div>}
        {message && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</div>}
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: '1px' }}>
        <X size={14} />
      </button>

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(100%); }
        }
        @keyframes toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Shortcuts
  const toast = {
    success: (title, message, opts) => addToast({ type: 'success', title, message, ...opts }),
    error:   (title, message, opts) => addToast({ type: 'error', title, message, ...opts }),
    warning: (title, message, opts) => addToast({ type: 'warning', title, message, ...opts }),
    info:    (title, message, opts) => addToast({ type: 'info', title, message, ...opts }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
        zIndex: 9999, alignItems: 'flex-end',
      }}>
        {toasts.map(t => (
          <Toast key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
