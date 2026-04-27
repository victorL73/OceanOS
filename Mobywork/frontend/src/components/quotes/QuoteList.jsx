import React from 'react';
import { FileText, MoreVertical, Calendar } from 'lucide-react';

export default function QuoteList({ quotes, selectedId, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
        <span className="gs-spinner" style={{ margin: '0 auto 1rem', display: 'block' }} />
        <p>Chargement des devis...</p>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <FileText size={32} opacity={0.3} style={{ margin: '0 auto 1rem' }} />
        <p>Aucun devis trouvé.</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
      switch(status) {
          case 'Envoyé': return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
          case 'Accepté': return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
          case 'Refusé': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
          case 'Expiré': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' };
          case 'Transformé': return { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
          default: return { bg: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8' }; // Brouillon
      }
  };

  return (
    <div className="list-scroll" style={{ flex: 1, overflowY: 'auto' }}>
      {quotes.map(q => {
        const isSelected = selectedId === q.id || (selectedId === 'new' && q.id === 'new');
        const st = getStatusColor(q.status);
        
        return (
          <div 
            key={q.id}
            onClick={() => onSelect(q.id)}
            style={{ 
              padding: '1.25rem 1rem', 
              borderBottom: '1px solid var(--border-color)', 
              cursor: 'pointer', 
              background: isSelected ? 'var(--bg-elevated)' : 'transparent',
              borderLeft: isSelected ? `3px solid var(--accent-blue)` : '3px solid transparent',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {q.client_name || 'Nouveau Client'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {parseFloat(q.total_ttc || 0).toFixed(2)} €
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{q.reference}</span>
                <span>•</span>
                <span>{new Date(q.date_updated).toLocaleDateString('fr-FR')}</span>
              </div>
              
              <span style={{ 
                  fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                  background: st.bg, color: st.color
              }}>
                {q.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
