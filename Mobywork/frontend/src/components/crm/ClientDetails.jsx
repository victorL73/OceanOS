import { Mail, Phone, Calendar, ShoppingBag, Send, Sparkles, Star, Tag, ChevronRight, FileText } from 'lucide-react';
import AIInsights from './AIInsights';
import Timeline from './Timeline';

export default function ClientDetails({ data, isLoading, onAction, onBack, onQuote }) {
  if (isLoading) {
    return (
      <div className="detail-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Chargement des données CRM...</p>
      </div>
    );
  }

  if (!data || !data.client) {
    return (
      <div className="detail-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', opacity: 0.5 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p style={{ marginTop: '1rem' }}>Sélectionnez un client dans la liste pour son analyse</p>
        </div>
      </div>
    );
  }

  const { client, orders } = data;

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
  const formatDate = (dateString) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateString));

  return (
    <div className="detail-panel detail-scroll">
      {/* Header Info */}
      <div className="detail-header responsive-header-flex">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <button className="mobile-back-btn" onClick={onBack} title="Retour à la liste">
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.4rem', color: 'var(--text-primary)', fontWeight: 800 }}>{client.nom}</h2>
            <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Mail size={14} style={{ color: 'var(--text-secondary)' }} /> {client.email}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Phone size={14} style={{ color: 'var(--text-secondary)' }} /> {client.telephone}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <span className="crm-badge" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }}/> 
            Inscrit depuis le {formatDate(client.dateInscription)}
          </span>
          <button 
             onClick={onQuote} 
             style={{ background: 'var(--accent-blue)', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          >
             <FileText size={14}/> Créer un devis
          </button>
        </div>
      </div>

      {/* Centre de Contrôle IA */}
      <AIInsights ai={client.ai} onAction={onAction} />

      {/* KIPs Metrics Grid */}
      <div className="crm-stats-grid grid-responsive-4">
        <div className="crm-stat-card">
          <div className="stat-label">Total Dépensé</div>
          <div className="stat-value">{formatPrice(client.totalSpent)}</div>
        </div>
        <div className="crm-stat-card">
          <div className="stat-label">Panier Moyen</div>
          <div className="stat-value">{formatPrice(client.avgCart)}</div>
        </div>
        <div className="crm-stat-card">
          <div className="stat-label">LTV Projetée</div>
          <div className="stat-value" style={{ color: 'var(--accent-indigo)' }}>{formatPrice(client.ltv)}</div>
        </div>
        <div className="crm-stat-card">
          <div className="stat-label">Délai d'achat</div>
          <div className="stat-value">{client.freqDays > 0 ? `${client.freqDays} j` : 'N/A'}</div>
        </div>
      </div>

      {/* Section Timeline & Activités */}
      <div style={{ marginTop: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
          <ShoppingBag size={18} style={{ color: 'var(--accent-blue)' }} /> Activité & Commandes
        </h3>
        
        <Timeline events={client.timeline} />
      </div>

    </div>
  );
}
