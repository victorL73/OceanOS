import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function OrderTimeline({ orders, isLoading, onSelect }) {
  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" color="var(--text-muted)" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={{ flex: 1, padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Clock size={48} style={{ opacity: 0.5, margin: '0 auto 1rem' }} />
        <p>Aucune chronologie disponible.</p>
      </div>
    );
  }

  // Grouper par date absolue (Jour)
  const groupedDates = {};
  orders.forEach(o => {
    const d = new Date(o.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groupedDates[d]) groupedDates[d] = [];
    groupedDates[d].push(o);
  });

  return (
    <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
        
        {/* Ligne centrale */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 16, width: 2, background: 'var(--border-color)' }} />

        {Object.keys(groupedDates).map(dateKey => (
          <div key={dateKey} style={{ marginBottom: '3rem' }}>
            
            {/* Header de la Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', position: 'relative', zIndex: 2 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-surface)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} color="var(--text-muted)" />
              </div>
              <h3 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1rem', color: 'var(--text-primary)' }}>{dateKey}</h3>
            </div>

            {/* Commandes de cette Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '3rem' }}>
              {groupedDates[dateKey].map(o => (
                <div 
                  key={o.id} 
                  onClick={() => onSelect(o)}
                  style={{ 
                    background: 'var(--bg-surface)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 12, 
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(5px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(o.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</div>
                    <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{o.client?.nom}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Réf: {o.reference} • {o.statut}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ fontWeight: 700 }}>{o.montant} €</div>
                    {o.priorite?.tag === 'URGENT' ? (
                      <AlertCircle size={20} color="var(--accent-red)" />
                    ) : o.statutCategory === 'expedie' ? (
                      <CheckCircle2 size={20} color="var(--accent-green)" />
                    ) : (
                      <Clock size={20} color="var(--text-muted)" />
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}
