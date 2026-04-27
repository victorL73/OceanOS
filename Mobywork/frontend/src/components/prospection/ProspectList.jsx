import React, { useState } from 'react';
import { Mail, Phone, MapPin, Building, Star, ChevronRight, TrendingUp } from 'lucide-react';

export default function ProspectList({ prospects, selectedId, onSelect, loading }) {
  const [hoveredCardId, setHoveredCardId] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
        <span className="gs-spinner" style={{ margin: '0 auto', marginBottom: '1rem', display: 'block' }} />
        <p>Analyse des prospects...</p>
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎣</p>
        <p>Aucun prospect ne correspond à vos filtres.</p>
        <p style={{ fontSize: '0.8rem' }}>Importez des données ou changez les filtres pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="list-selection" style={{ background: 'transparent' }}>
      {prospects.map(p => {
        const isActive = selectedId === p.id;
        const isHovered = hoveredCardId === p.id;
        const confValue = p.confidence || 0;
        const confColor = confValue > 75 ? '#10b981' : confValue > 30 ? '#f59e0b' : '#94a3b8';
        
        return (
          <div 
            key={p.id} 
            onMouseEnter={() => setHoveredCardId(p.id)}
            onMouseLeave={() => setHoveredCardId(null)}
            onClick={() => onSelect(p.id)}
            style={{ 
              cursor: 'pointer',
              padding: '1.25rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: isActive ? 'rgba(59, 130, 246, 0.08)' : (isHovered ? 'rgba(255,255,255,0.02)' : 'transparent'),
              transition: 'background 0.2s ease',
              borderLeft: isActive ? `3px solid var(--accent-blue)` : '3px solid transparent'
            }}
          >
            {/* ROW 1: ENTETE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '8px', 
                  background: 'rgba(255,255,255,0.05)', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem'
                }}>
                  {p.type?.includes('naval') ? '⚓' : '⛵'}
                </div>
                <div style={{ fontWeight: 600, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                  {p.company_name}
                </div>
              </div>
              
              <span style={{ 
                fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                background: p.status === 'Nouveau' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: p.status === 'Nouveau' ? '#3b82f6' : '#10b981',
              }}>
                {p.status}
              </span>
            </div>

            {/* ROW 2: CATEGORY & LOCATION */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.75rem' }}>
              {p.category ? (
                <span style={{ 
                  background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', 
                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' 
                }}>
                  {p.category}
                </span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2px 0' }}>Sans catégorie</span>
              )}
              {p.city && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  • <MapPin size={10} /> {p.city}
                </span>
              )}
            </div>

            {/* ROW 3: CONTACTS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={12} opacity={0.5} /> {p.email || '—'}
              </div>
              {p.phone && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={12} opacity={0.5} /> {p.phone}
                </div>
              )}
            </div>

            {/* ROW 4: AI CONFIDENCE BAR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confiance
              </div>
              <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${confValue}%`, background: confColor, borderRadius: '2px', transition: 'width 0.5s ease-out' }} />
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: confColor }}>{confValue}%</span>
            </div>

          </div>
        );
      })}
    </div>
  );
}
