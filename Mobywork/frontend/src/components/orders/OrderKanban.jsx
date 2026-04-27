import React from 'react';
import { Loader2, Package, Truck, AlertCircle, CheckCircle } from 'lucide-react';

const KANBAN_COLUMNS = [
  { id: 'attente', label: 'À Traiter', icon: AlertCircle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  { id: 'expedie', label: 'Expédié',   icon: Truck,       color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  { id: 'annule',  label: 'Annulé',    icon: CheckCircle, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }
];

export default function OrderKanban({ orders, isLoading, onSelect, onAction }) {
  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" color="var(--text-muted)" />
      </div>
    );
  }

  // Grouper les commandes par catégorie
  const groupedOrders = { attente: [], expedie: [], annule: [] };
  orders.forEach(o => {
    let cat = o.statutCategory;
    if (cat === 'a_traiter') cat = 'attente'; // Fusionner pour le Kanban
    if (groupedOrders[cat]) {
      groupedOrders[cat].push(o);
    }
  });

  const handleDragStart = (e, order) => {
    e.dataTransfer.setData('orderId', order.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Nécessaire pour autoriser le drop
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (!orderId) return;

    if (targetColId === 'expedie') {
        onAction('marquer_traite', parseInt(orderId));
    } else if (targetColId === 'annule') {
        onAction('marquer_annule', parseInt(orderId));
    }
    // Si déposé de retour sur attente, on pourrait implémenter marquer_attente
  };

  return (
    <div style={{ flex: 1, display: 'flex', gap: '1.5rem', padding: '1.5rem', overflowX: 'auto', background: 'var(--bg-base)' }}>
      {KANBAN_COLUMNS.map(col => (
        <div 
          key={col.id} 
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col.id)}
          style={{ 
            flex: '0 0 320px', 
            display: 'flex', 
            flexDirection: 'column', 
            background: 'var(--bg-surface)', 
            borderRadius: 12, 
            border: '1px solid var(--border-color)',
            maxHeight: '100%',
            overflow: 'hidden'
          }}
        >
          {/* Column Header */}
          <div style={{ 
            padding: '1rem', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <col.icon size={16} color={col.color} />
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{col.label}</h3>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: col.bg, color: col.color }}>
              {groupedOrders[col.id].length}
            </div>
          </div>

          {/* Cards Container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {groupedOrders[col.id].map(o => (
              <div 
                key={o.id}
                draggable
                onDragStart={(e) => handleDragStart(e, o)}
                onClick={() => onSelect(o)}
                style={{ 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 8, 
                  padding: '1rem', 
                  cursor: 'grab',
                  position: 'relative',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {o.priorite?.tag === 'URGENT' && (
                  <div style={{ position: 'absolute', top: -1, right: 12, background: 'var(--accent-red)', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: '0 0 6px 6px' }}>URGENT</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', pointerEvents: 'none' }}>{o.client?.nom}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, pointerEvents: 'none' }}>{o.montant} €</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', pointerEvents: 'none' }}>
                  Réf: {o.reference} • Il y a {(new Date() - new Date(o.date))/(1000*60*60) < 24 ? Math.floor((new Date() - new Date(o.date))/(1000*60*60)) + 'h' : Math.floor((new Date() - new Date(o.date))/(1000*60*60*24)) + 'j'}
                </div>
                {col.id === 'attente' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onAction('marquer_traite', o.id); }}
                    style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-primary)', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <Truck size={14} /> Expédier
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
