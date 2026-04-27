import React from 'react';
import { MoreHorizontal, GripVertical, Mail, MapPin } from 'lucide-react';

const COLUMNS = [
  'Nouveau',
  'Nettoyé',
  'À contacter',
  'Email envoyé',
  'Relance',
  'Chaud',
  'Perdu'
];

export default function ProspectKanban({ prospects, onUpdateStatus, onSelect }) {
  
  const getProspectsByStatus = (status) => {
    return prospects.filter(p => p.status === status);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('prospectId', id);
  };

  const handleDrop = async (e, status) => {
    const id = e.dataTransfer.getData('prospectId');
    onUpdateStatus(id, { status });
  };

  return (
    <div className="kanban-wrapper" style={{ 
      display: 'flex', 
      gap: '1rem', 
      padding: '1.5rem', 
      height: '100%', 
      overflowX: 'auto',
      alignItems: 'flex-start'
    }}>
      {COLUMNS.map(col => (
        <div 
          key={col}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col)}
          style={{ 
            minWidth: '280px', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '100%'
          }}
        >
          {/* Header de colonne */}
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {col}
            </span>
            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
              {getProspectsByStatus(col).length}
            </span>
          </div>

          {/* Liste des cards */}
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {getProspectsByStatus(col).map(p => (
              <div 
                key={p.id}
                draggable
                onDragStart={(e) => handleDragStart(e, p.id)}
                onClick={() => onSelect(p.id)}
                style={{ 
                  background: 'rgba(23, 27, 34, 0.8)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'grab',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, border-color 0.2s',
                  position: 'relative'
                }}
                className="kanban-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.company_name}</div>
                  <GripVertical size={14} opacity={0.3} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={10} /> {p.city || 'Ville inconnue'}
                  </div>
                  {p.email && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={10} /> {p.email}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ 
                      fontSize: '0.7rem', fontWeight: 700, 
                      color: p.score > 70 ? '#10b981' : '#f59e0b' 
                   }}>
                      {p.score}% Score
                   </div>
                   <div style={{ 
                     width: '18px', height: '18px', borderRadius: '50%', 
                     background: p.type?.includes('naval') ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem'
                   }}>
                     ⚓
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
