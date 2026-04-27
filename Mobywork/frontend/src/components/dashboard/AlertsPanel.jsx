import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, Mail, AlertTriangle, Users, X } from 'lucide-react';

const API = 'http://localhost:3002/api';

const authConfig = () => {
  const token = localStorage.getItem('moby_token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const EMPTY_ALERTS_DATA = {
  abandonedCarts: [],
  clientsSegments: [],
  emailActivity: [],
  template: '',
};

function AbandonedCartsBlock({ abandonedCarts, template, onDismiss }) {
  const [relaunching, setRelaunching] = useState({});

  const handleRelaunch = async (cart) => {
    if (!cart.clientEmail) {
      alert(`Email introuvable pour ${cart.client}`);
      return;
    }
    setRelaunching(prev => ({ ...prev, [cart.id]: 'loading' }));
    
    // Remplacement des variables dans le template
    let messageText = template || "Bonjour {{client}},\n\nVous avez oublié ceci : {{produits}}";
    messageText = messageText.replace(/{{client}}/g, cart.client)
                             .replace(/{{montant}}/g, cart.amount)
                             .replace(/{{produits}}/g, cart.products.join('\n- '));

    try {
      await axios.post(`${API}/crm/send-email`, {
        to: cart.clientEmail,
        subject: `N'oubliez pas votre panier !`,
        message: messageText,
        type: 'relance'
      }, authConfig());
      setRelaunching(prev => ({ ...prev, [cart.id]: 'done' }));
    } catch (err) {
      console.error(err);
      setRelaunching(prev => ({ ...prev, [cart.id]: 'error' }));
      alert("Échec de l'envoi.");
    }
  };

  return (
    <div className="db-card">
      <div className="db-card-header">
        <div className="db-card-title"><ShoppingCart size={15} /> Paniers abandonnés</div>
        <span className="db-card-subtitle alert-badge">
          <AlertTriangle size={11} /> {abandonedCarts.length} actifs
        </span>
      </div>
      <div className="alerts-list">
        {abandonedCarts.map(cart => (
          <div key={cart.id} className="alert-row" style={{ position: 'relative' }}>
            <div className="alert-avatar">
              {cart.client.split(' ').map(w => w[0]).join('').slice(0,2)}
            </div>
            <div className="alert-info">
              <div className="alert-name">{cart.client}</div>
              <div className="alert-meta">{cart.products.join(', ')}</div>
            </div>
            <div className="alert-amount">{cart.amount}€</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button 
                className="alert-action-btn"
                onClick={() => handleRelaunch(cart)}
                disabled={!!relaunching[cart.id]}
                style={{
                  opacity: relaunching[cart.id] === 'done' ? 0.6 : 1,
                  cursor: relaunching[cart.id] ? 'not-allowed' : 'pointer'
                }}
              >
                {relaunching[cart.id] === 'loading' ? '⏳' : 
                 relaunching[cart.id] === 'done' ? '✓ Fait' : 
                 'Relancer'}
              </button>
              <button 
                 onClick={() => onDismiss(cart.id)}
                 style={{
                   background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                   display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
                 }}
                 title="Ignorer ce panier"
                 onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                 onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                 <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientSegmentsBlock({ clientsSegments }) {
  const total = clientsSegments.reduce((s, c) => s + c.count, 0);
  return (
    <div className="db-card">
      <div className="db-card-header">
        <div className="db-card-title"><Users size={15} /> Segments clients</div>
        <span className="db-card-subtitle">{total} total</span>
      </div>
      <div className="segments-list">
        {clientsSegments.map(seg => (
          <div key={seg.label} className="seg-row">
            <div className="seg-dot" style={{ background: seg.color }} />
            <div className="seg-label">{seg.label}</div>
            <div className="seg-bar-wrap">
              <div className="seg-bar-fill" style={{ width: `${seg.pct}%`, background: seg.color }} />
            </div>
            <div className="seg-count" style={{ color: seg.color }}>{seg.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailActivityBlock({ emailActivity }) {
  const max = Math.max(1, ...emailActivity.map(d => Math.max(d.received, d.replied)));
  return (
    <div className="db-card">
      <div className="db-card-header">
        <div className="db-card-title"><Mail size={15} /> Activité emails (7j)</div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> Reçus
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Répondus
          </span>
        </div>
      </div>
      <div className="email-activity-bars">
        {emailActivity.map(d => (
          <div key={d.day} className="ea-col">
            <div className="ea-bars">
              <div className="ea-bar received" style={{ height: `${(d.received / max) * 100}%` }} title={`${d.received} reçus`} />
              <div className="ea-bar replied" style={{ height: `${(d.replied / max) * 100}%` }} title={`${d.replied} répondus`} />
            </div>
            <div className="ea-day">{d.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AlertsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await axios.get(`${API}/dashboard/alerts`, authConfig());
        setData(res.data);
      } catch (err) {
        console.error("Erreur chargement des alertes:", err);
        setData(EMPTY_ALERTS_DATA);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const handleDismissCart = async (cartId) => {
    try {
      await axios.post(`${API}/dashboard/dismiss-cart`, { cartId }, authConfig());
      setData(prev => ({
        ...prev,
        abandonedCarts: prev.abandonedCarts.filter(c => c.id !== cartId)
      }));
    } catch (err) {
      console.error("Erreur masquage:", err);
    }
  };

  if (loading || !data) {
    return (
      <div className="alerts-panel-grid" style={{ opacity: 0.6 }}>
        <div className="db-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px' }}>Chargement...</div>
        <div className="db-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px' }}>Chargement...</div>
        <div className="db-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '250px' }}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className="alerts-panel-grid" style={{ paddingRight: '20px' }}>
      <AbandonedCartsBlock 
        abandonedCarts={data.abandonedCarts} 
        template={data.template} 
        onDismiss={handleDismissCart}
      />
      <ClientSegmentsBlock clientsSegments={data.clientsSegments} />
      <EmailActivityBlock emailActivity={data.emailActivity} />
    </div>
  );
}
