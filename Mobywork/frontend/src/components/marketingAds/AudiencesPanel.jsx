import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3002/api/marketing';

export default function AudiencesPanel() {
  const [audiences, setAudiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    fetchAudiences();
  }, []);

  const fetchAudiences = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/audiences`);
      setAudiences(res.data);
    } catch (err) {
      console.error("Erreur audiences:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggest = async () => {
    try {
        setIsSuggesting(true);
        // Simuler un appel avec analyse du CRM pour suggérer des audiences
        const crmRes = await axios.get('http://localhost:3002/api/dashboard/alerts');
        const crmSummary = `Segments: ${crmRes.data.clientsSegments.map(s => `${s.label} (${s.count})`).join(', ')}`;
        
        const res = await axios.post(`${API_URL}/suggest-audiences`, { crmSummary });
        setSuggestions(res.data.audiences || []);
    } catch (err) {
        console.error("Erreur suggestions audiences:", err);
    } finally {
        setIsSuggesting(false);
    }
  }

  const handleCreateFromSuggestion = async (suggested) => {
    try {
        await axios.post(`${API_URL}/audiences`, {
            name: suggested.name,
            type: suggested.type,
            size: suggested.estimatedSize,
            source: 'ia_suggested',
            description: suggested.description
        });
        setSuggestions(suggestions.filter(s => s.name !== suggested.name));
        fetchAudiences();
    } catch (err) {
        console.error("Erreur création suggestion:", err);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
      {/* Liste des audiences existantes */}
      <div className="db-card" style={{ padding: 0 }}>
        <div className="db-card-header" style={{ padding: '1.25rem' }}>
          <div className="db-card-title">🎯 Audiences Actives</div>
          <button className="gtb-btn-add">➕ Nouvelle Audience</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Nom de l'Audience</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Taille Est.</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Source</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {audiences.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{a.name}</td>
                  <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{a.type}</td>
                  <td style={{ padding: '1rem' }}>{a.size.toLocaleString()}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                        padding: '2px 6px', 
                        background: 'var(--bg-elevated)', 
                        borderRadius: '4px', 
                        fontSize: '0.7rem' 
                    }}>
                        {a.source}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                        color: a.status === 'active' ? 'var(--accent-green)' : 'var(--text-muted)',
                        fontWeight: 700 
                    }}>
                        {a.status === 'active' ? '● En cours' : '○ Archive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suggestions IA d'audiences basées sur CRM */}
      <div className="ai-feed-panel">
        <div className="ai-feed-header">
            <div className="ai-feed-title">🧠 Suggestions IA</div>
            <button 
                onClick={handleSuggest} 
                disabled={isSuggesting} 
                className="ai-feed-refresh"
                style={{ cursor: isSuggesting ? 'not-allowed' : 'pointer' }}
            >
                {isSuggesting ? '⏳' : '✨ Recommandations'}
            </button>
        </div>
        
        <div className="ai-feed-list" style={{ padding: '1rem' }}>
            {isSuggesting && (
                <div className="ai-feed-loading">
                    <span>L'IA analyse le CRM Renovboat...</span>
                    <div className="ai-feed-loading-bar"></div>
                </div>
            )}

            {!isSuggesting && suggestions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Cliquez sur "Recommandations" pour identifier des segments publicitaires à partir de vos clients actuels.
                </div>
            )}

            {suggestions.map((s, idx) => (
                <div key={idx} className="ai-suggestion-card" style={{ '--sug-color': 'var(--accent-indigo)' }}>
                    <div className="sug-accent-bar"></div>
                    <div className="sug-content" style={{ padding: '1rem' }}>
                        <div className="sug-title" style={{ color: 'var(--accent-indigo)', fontSize: '0.88rem' }}>{s.name}</div>
                        <div className="sug-description" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{s.description}</div>
                        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="sug-impact" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {s.type} • ~{s.estimatedSize.toLocaleString()}
                            </span>
                            <button 
                                onClick={() => handleCreateFromSuggestion(s)}
                                className="sug-btn execute" 
                                style={{ padding: '0.25rem 0.6rem' }}
                            >
                                Créer
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
