import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/marketing`;

export default function CampaignsList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/campaigns`);
      setCampaigns(res.data);
    } catch (err) {
      console.error("Erreur fetching campagnes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await axios.patch(`${API_URL}/campaigns/${id}/status`, { status: newStatus });
      fetchCampaigns();
    } catch (err) {
      console.error("Erreur toggle status:", err);
    }
  };

  const handleUpdateBudget = async (id, action) => {
    try {
      await axios.patch(`${API_URL}/campaigns/${id}/budget`, { action });
      fetchCampaigns();
    } catch (err) {
      console.error("Erreur update budget:", err);
    }
  };

  const handleDuplicate = async (id) => {
    if (!window.confirm("Dupliquer cette campagne ?")) return;
    try {
      await axios.post(`${API_URL}/campaigns/${id}/duplicate`);
      fetchCampaigns();
    } catch (err) {
      console.error("Erreur duplication:", err);
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'all') return true;
    return c.platform === filter;
  });

  if (loading) return <div className="ai-feed-loading">Chargement des campagnes...</div>;

  return (
    <div className="db-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="db-card-header" style={{ padding: '1.25rem' }}>
        <div className="db-card-title">📣 Gestion des Campagnes</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setFilter('all')} 
            className={`chart-period-btn ${filter === 'all' ? 'active' : ''}`}
          >
            Toutes
          </button>
          <button 
            onClick={() => setFilter('google')} 
            className={`chart-period-btn ${filter === 'google' ? 'active' : ''}`}
          >
            Google
          </button>
          <button 
            onClick={() => setFilter('meta')} 
            className={`chart-period-btn ${filter === 'meta' ? 'active' : ''}`}
          >
            Meta
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Nom</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Plateforme</th>
              <th className="hide-mobile" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Budget/j</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>ROAS</th>
              <th className="hide-mobile" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>CPC</th>
              <th className="hide-mobile" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>CTR</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Score</th>
              <th className="hide-mobile" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Statut</th>
              <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                <td style={{ padding: '1rem', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '1rem' }}>
                    <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.4rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: c.platform === 'google' ? 'rgba(66,133,244,0.1)' : 'rgba(24,119,242,0.1)',
                        color: c.platform === 'google' ? '#4285f4' : '#1877f2',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase'
                    }}>
                        {c.platform === 'google' ? 'Google Ads' : 'Meta Ads'}
                    </span>
                </td>
                <td className="hide-mobile" style={{ padding: '1rem' }}>{c.budget_daily} €</td>
                <td style={{ padding: '1rem', color: c.roas > 4 ? 'var(--accent-green)' : 'inherit', fontWeight: c.roas > 4 ? 700 : 400 }}>
                    {c.roas}x
                </td>
                <td className="hide-mobile" style={{ padding: '1rem' }}>{c.cpc} €</td>
                <td className="hide-mobile" style={{ padding: '1rem' }}>{c.ctr}%</td>
                <td style={{ padding: '1rem' }}>
                    <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        fontWeight: 800,
                        background: c.score === 'A' ? 'var(--accent-green)' : c.score === 'B' ? 'var(--accent-blue)' : c.score === 'C' ? 'var(--accent-orange)' : 'var(--accent-red)',
                        color: 'white'
                    }}>
                        {c.score}
                    </span>
                </td>
                <td className="hide-mobile" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            background: c.status === 'active' ? 'var(--accent-green)' : 'var(--text-muted)'
                        }}></div>
                        <span style={{ fontSize: '0.75rem' }}>{c.status === 'active' ? 'Actif' : 'En pause'}</span>
                    </div>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button 
                            onClick={() => handleToggleStatus(c.id, c.status)} 
                            title={c.status === 'active' ? 'Pause' : 'Play'}
                            className="gtb-btn" style={{ width: '28px', height: '28px' }}
                        >
                            {c.status === 'active' ? '⏸️' : '▶️'}
                        </button>
                        <button 
                            onClick={() => handleUpdateBudget(c.id, 'increase_10')} 
                            title="+10% budget"
                            className="gtb-btn" style={{ width: '28px', height: '28px' }}
                        >
                            ⬆️
                        </button>
                        <button 
                            onClick={() => handleUpdateBudget(c.id, 'decrease_10')} 
                            title="-10% budget"
                            className="gtb-btn" style={{ width: '28px', height: '28px' }}
                        >
                            ⬇️
                        </button>
                        <button 
                            onClick={() => handleDuplicate(c.id)} 
                            title="Dupliquer"
                            className="gtb-btn" style={{ width: '28px', height: '28px' }}
                        >
                            📋
                        </button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
