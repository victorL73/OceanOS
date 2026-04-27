import React from 'react';
import { Users, Star, AlertCircle, Clock, Zap, TrendingUp, XOctagon } from 'lucide-react';

export default function CRMSidebar({ activeFilter, onFilterChange }) {
  const filters = [
    { id: 'tous', label: 'Tous les clients', icon: <Users size={16} /> },
    { id: 'vip', label: 'VIP', icon: <Star size={16} />, countClass: 'green', color: '#10b981' },
    { id: 'gros_depensiers', label: 'Gros Dépensiers', icon: <TrendingUp size={16} />, color: '#3b82f6' },
    { id: 'nouveaux_clients', label: 'Nouveaux', icon: <Zap size={16} />, color: '#8b5cf6' },
    { id: 'relancer', label: 'À relancer', icon: <AlertCircle size={16} />, countClass: 'orange', color: '#f59e0b' },
    { id: 'perdu', label: 'Perdus', icon: <XOctagon size={16} />, color: '#ef4444' },
    { id: 'inactif', label: 'Inactifs', icon: <Clock size={16} />, color: '#64748b' },
  ];

  return (
    <aside className="sidebar">
      <span className="sidebar-section-label" style={{ marginTop: '1rem' }}>CRM Clients</span>

      {filters.map((filter) => (
        <div
          key={filter.id}
          className={`sidebar-item ${activeFilter === filter.id ? 'active' : ''}`}
          onClick={() => onFilterChange(filter.id)}
        >
          <span className="item-icon" style={{ color: filter.color || '' }}>
            {filter.icon}
          </span>
          <span style={{ flex: 1 }}>{filter.label}</span>
        </div>
      ))}

      <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <button className="crm-btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderColor: 'transparent', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }} onClick={() => onFilterChange('relancer')}>
          <Zap size={16} strokeWidth={2.5} />
          Voir opportunités
        </button>
      </div>
    </aside>
  );
}
