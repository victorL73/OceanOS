import React from 'react';

// Génère les initiales depuis le nom
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// Assigne une couleur aléatoire (déterministe) basée sur le nom
function stringToColorClass(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['bg-indigo', 'bg-blue', 'bg-green', 'bg-purple', 'bg-orange'];
  return colors[Math.abs(hash) % colors.length];
}

export default function ClientCard({ client, isSelected, onClick }) {
  const { nom, email, totalSpent, ordersCount, ai } = client;
  
  // Classe de couleur en fonction du tag IA
  let tagClass = 'badge-normal';
  if (ai?.tag === 'VIP') tagClass = 'badge-vip';
  if (ai?.tag === 'À relancer') tagClass = 'badge-risk';
  if (ai?.tag === 'Fragile') tagClass = 'badge-fragile';
  if (ai?.tag === 'Perdu') tagClass = 'badge-perdu';

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
  
  const initials = getInitials(nom);
  const colorClass = stringToColorClass(nom);

  return (
    <div className={`crm-list-item ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
        <div className={`crm-avatar ${colorClass}`}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 className="crm-card-title">{nom}</h4>
            <span className={`crm-badge ${tagClass}`}>{ai?.tag || 'Normal'}</span>
          </div>
          <div className="crm-card-subtitle">{email}</div>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingLeft: '2.5rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}><b>{ordersCount}</b> cde(s)</span>
        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{formatPrice(totalSpent)}</span>
      </div>
    </div>
  );
}
