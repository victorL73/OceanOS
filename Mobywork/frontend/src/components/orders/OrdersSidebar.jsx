import React from 'react';
import { Layers, AlertTriangle, Clock, Truck, ShieldCheck, Diamond, Settings } from 'lucide-react';

const FILTERS = [
  { id: 'toutes',    label: 'Toutes les commandes', icon: Layers },
  { id: 'urgentes',  label: 'Urgentes (IA)',        icon: AlertTriangle, color: 'var(--accent-red)' },
  { id: 'a_traiter', label: 'À traiter',            icon: Clock },
  { id: 'en_retard', label: 'En retard',            icon: Clock,         color: 'var(--accent-orange)' },
  { id: 'expediees', label: 'Expédiées',            icon: Truck,         color: 'var(--accent-green)' },
  { id: 'vip',       label: 'Clients VIP',          icon: Diamond,       color: 'var(--accent-purple)' },
  { id: 'annulees',  label: 'Annulées',             icon: ShieldCheck,   color: 'var(--text-muted)' },
];

export default function OrdersSidebar({ activeFilter, onFilterChange, orders }) {
  return (
    <div className="sidebar" style={{ width: 200, flexShrink: 0 }}>
      <div style={{ padding: '0 0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #f59e0b, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Layers size={15} color="white" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Commandes</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MobyWorkspace</span>
        </div>
      </div>

      <div style={{ padding: '0 0.25rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.4rem', paddingLeft: '0.5rem' }}>
          Filtres IA
        </div>
        
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.6rem',
              borderRadius: 7,
              background: activeFilter === f.id ? 'var(--bg-tertiary)' : 'transparent',
              color: activeFilter === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 1,
              transition: 'all 0.15s',
              textAlign: 'left'
            }}
          >
            <f.icon size={14} color={f.color || 'currentColor'} style={{ opacity: activeFilter === f.id ? 1 : 0.65, flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', flex: 1, fontWeight: activeFilter === f.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: '1rem 0.5rem 0', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem',
          background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem'
        }}>
          <Settings size={14} /> Paramètres Commandes
        </button>
      </div>
    </div>
  );
}
