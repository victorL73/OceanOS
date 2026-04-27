import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MarketingDashboard from './MarketingDashboard';
import CampaignsList from './CampaignsList';
import AiSuggestionsPanel from './AiSuggestionsPanel';
import AudiencesPanel from './AudiencesPanel';
import AutomationPanel from './AutomationPanel';
import MarketingCopilot from './MarketingCopilot';
import NautiPostModule from '../marketing/NautiPostModule';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/marketing`;

export default function MarketingModule() {
  const [activeTab, setActiveTab] = useState('dashboard'); // Dashboard by default
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/dashboard`);
      setDashboardData(res.data);
    } catch (err) {
      console.error("Erreur fetching dashboard marketing:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDemo = async () => {
    if (!window.confirm("Voulez-vous vraiment supprimer toutes les données de démonstration ? Cela nettoiera votre historique et vos campagnes de test.")) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/demo`);
      fetchDashboard();
    } catch (err) {
      alert("Erreur lors de la suppression des données.");
    } finally {
      setLoading(false);
    }
  };

  // Strictly following the user's requested order:
  // 1. Dashboard, 2. Feed IA, 3. Campagnes, 4. Audiences, 5. Social Posts, 6. Automatisation, 7. Copilote
  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'feed', label: '🧠 Feed IA' },
    { id: 'campaigns', label: '📣 Campagnes' },
    { id: 'audiences', label: '👥 Audiences' },
    { id: 'nautipost', label: '🚀 Social Posts' },
    { id: 'automation', label: '⚙️ Automatisation' },
    { id: 'copilot', label: '💬 Copilote' },
  ];

  return (
    <div className="marketing-module-main" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: 'var(--bg-base)', 
      width: '100% !important', 
      maxWidth: 'none !important',
      margin: '0 !important',
      flex: 1
    }}>
      {/* Header avec Navigation par Onglets */}
      <header style={{ 
        padding: '1.25rem 2rem 0', 
        background: 'var(--bg-surface)', 
        borderBottom: '1px solid var(--border)',
        flexShrink: 0 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h1 className="dashboard-title" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              🚀 Marketing IA — MobyWorkspace
            </h1>
            <p className="dashboard-subtitle" style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                Pilotez vos performances publicitaires et sociales avec l'aide de l'IA.
            </p>
          </div>
        </div>

        <nav className="marketing-tabs-nav" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`chart-period-btn ${activeTab === tab.id ? 'active' : ''}`}
              style={{ 
                padding: '0.7rem 1.25rem', 
                fontSize: '0.88rem', 
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                borderRadius: '8px 8px 0 0',
                background: activeTab === tab.id ? 'var(--bg-base)' : 'transparent'
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Zone de contenu principale scrollable */}
      <main className="module-scroll" style={{ padding: '1rem', flex: 1, height: '100%', overflowY: 'auto' }}>
        
        {/* BANNIÈRE DÉMO */}
        {dashboardData?.isDemo && (
          <div className="mobile-stack" style={{ 
            background: 'rgba(59, 130, 246, 0.1)', 
            border: '1px solid rgba(59, 130, 246, 0.2)', 
            borderRadius: '12px', 
            padding: '1rem 1.5rem', 
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'fadeIn 0.5s',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Mode Démonstration Actif</strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Données factices. Connectez vos APIs réelles dans les réglages.</p>
              </div>
            </div>
            <button 
              onClick={handleClearDemo}
              style={{ 
                padding: '0.6rem 1.2rem', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px', 
                color: 'var(--text-primary)', 
                fontWeight: 600, 
                fontSize: '0.835rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              🗑️ Vider démo
            </button>
          </div>
        )}
        <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
            {loading && activeTab === 'dashboard' ? (
                <div className="ai-feed-loading" style={{ margin: '4rem auto', maxWidth: '400px' }}>
                    <div className="gs-spinner"></div>
                    <span>Chargement des données marketing...</span>
                </div>
            ) : (
                <div style={{ width: '100%' }}>
                    {activeTab === 'dashboard' && <MarketingDashboard data={dashboardData} refresh={fetchDashboard} />}
                    {activeTab === 'feed' && <AiSuggestionsPanel />}
                    {activeTab === 'campaigns' && <CampaignsList />}
                    {activeTab === 'audiences' && <AudiencesPanel />}
                    {activeTab === 'nautipost' && <NautiPostModule />}
                    {activeTab === 'automation' && <AutomationPanel />}
                    {activeTab === 'copilot' && <MarketingCopilot />}
                </div>
            )}
        </div>
      </main>

      <style>{`
        .chart-period-btn.active {
          color: var(--accent-blue);
          font-weight: 700;
        }
        .module-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
