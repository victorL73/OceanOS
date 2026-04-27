import React, { useState } from 'react';
import { Search, Loader2, Truck, Mail, MoreVertical } from 'lucide-react';

const PRIORITY_BADGE = {
  URGENT: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' },
  HAUTE: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' },
  NORMAL: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
};

function formatTimeAgo(dateString) {
  const diffHours = Math.floor((new Date() - new Date(dateString)) / (1000 * 60 * 60));
  if (diffHours < 24) return `il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `il y a ${diffDays}j`;
}

export default function OrderList({ orders, selectedOrderId, onSelect, searchTerm, onSearch, isLoading, onAction }) {
  const [hoveredCardId, setHoveredCardId] = useState(null);

  return (
    <div className="list-selection" style={{ borderRight: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
      <div className="list-header" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="search-box" style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Rechercher une commande..." 
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          />
        </div>
      </div>

      <div className="list-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '0.85rem' }}>Synchronisation des commandes...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.85rem' }}>Aucune commande trouvée.</p>
          </div>
        ) : (
          orders.map((o) => {
            const isSelected = selectedOrderId === o.id;
            const prioBadge = PRIORITY_BADGE[o.priorite?.tag] || PRIORITY_BADGE.NORMAL;
            const isHovered = hoveredCardId === o.id;

            return (
              <div 
                key={o.id}
                onMouseEnter={() => setHoveredCardId(o.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                onClick={() => onSelect(o)}
                style={{ 
                  padding: '1rem', 
                  borderBottom: '1px solid var(--border-color)', 
                  cursor: 'pointer', 
                  position: 'relative',
                  background: isSelected ? 'var(--bg-elevated)' : isHovered ? 'var(--bg-base)' : 'var(--bg-surface)',
                  transition: 'background 0.2s ease',
                  borderLeft: isSelected ? `3px solid ${prioBadge.color}` : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {o.client?.nom}
                    {o.client?.isVIP && <span style={{ fontSize: '0.5rem', background: 'var(--accent-purple)', color: 'white', padding: '2px 4px', borderRadius: 4, fontWeight: 800 }}>VIP</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: o.montant > 500 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
                      {o.montant} €
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isHovered ? '0.75rem' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{o.reference} • {formatTimeAgo(o.date)}</span>
                  </div>
                  <div style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: prioBadge.bg,
                    color: prioBadge.color,
                  }}>
                    {o.priorite?.tag}
                  </div>
                </div>

                {isHovered && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    animation: 'fadeIn 0.2s',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed var(--border-color)'
                  }}>
                    {(o.statutCategory === 'attente' || o.statutCategory === 'a_traiter') && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onAction('marquer_traite', o.id); }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.4rem', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <Truck size={12} /> Expédier
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); alert('Contacter: ' + o.client.email); }}
                      style={{ flex: o.statutCategory === 'attente' || o.statutCategory === 'a_traiter' ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.4rem', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Mail size={12} /> Email
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
