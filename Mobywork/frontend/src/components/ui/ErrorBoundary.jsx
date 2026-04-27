import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('💥 ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-base)', padding: '2rem',
        }}>
          <div style={{
            maxWidth: 480, width: '100%', textAlign: 'center',
            background: 'var(--bg-surface)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 20, padding: '3rem 2.5rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', color: '#ef4444'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Oups ! Une erreur s'est produite
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Ce module a rencontré une erreur inattendue. Vous pouvez tenter de le recharger ou retourner au tableau de bord.
            </p>

            {this.state.error && (
              <details style={{ marginBottom: '2rem', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                  Détails techniques
                </summary>
                <pre style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '0.75rem', marginTop: '0.5rem',
                  fontSize: '0.72rem', color: '#ef4444', overflow: 'auto',
                  maxHeight: 150, lineHeight: 1.5
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.7rem 1.25rem', borderRadius: 10,
                  background: 'var(--accent-blue)', color: 'white',
                  border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                }}
              >
                <RefreshCw size={15} /> Réessayer
              </button>
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.7rem 1.25rem', borderRadius: 10,
                  background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                }}
              >
                <Home size={15} /> Recharger l'app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
