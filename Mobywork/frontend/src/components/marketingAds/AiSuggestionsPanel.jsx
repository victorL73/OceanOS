import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3002/api/marketing';

export default function AiSuggestionsPanel() {
  const [suggestions, setSuggestions] = useState([]);
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    handleAnalyze();
  }, []);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/analyze`);
      setSuggestions(res.data.suggestions || []);
      setInsight(res.data.globalInsight || '');
    } catch (err) {
      console.error("Erreur analyse IA:", err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      default: return '#10b981';
    }
  };

  return (
    <div className="ai-feed-panel">
      <div className="ai-feed-header">
        <div className="ai-feed-title">
          <span className="ai-feed-icon">🧠</span>
          IA Marketing — Suggestions & Insights
        </div>
        <button 
          onClick={handleAnalyze} 
          disabled={loading}
          className="ai-feed-refresh"
          style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '⏳' : '🔄'} Analyser avec l'IA
        </button>
      </div>

      {loading && (
        <div className="ai-feed-loading">
          <span>L'IA analyse vos campagnes publicitaires...</span>
          <div className="ai-feed-loading-bar"></div>
        </div>
      )}

      {!loading && insight && (
        <div style={{ 
          padding: '1rem 1.25rem', 
          background: 'rgba(59,130,246,0.05)', 
          borderBottom: '1px solid var(--border)',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'var(--accent-blue)',
          fontStyle: 'italic'
        }}>
            " {insight} "
        </div>
      )}

      <div className="ai-feed-list" style={{ padding: '1rem' }}>
        {!loading && suggestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Cliquez sur "Analyser" pour obtenir des recommandations intelligentes.
          </div>
        )}
        
        {suggestions.map((s, idx) => (
          <div 
            key={idx} 
            className="ai-suggestion-card" 
            style={{ 
              '--sug-color': getPriorityColor(s.priority),
              '--sug-border': `rgba(${s.priority === 'urgent' ? '239,68,68' : '59,130,246'}, 0.2)`
            }}
          >
            <div className="sug-accent-bar"></div>
            <div className="sug-content">
              <div className="sug-top-row">
                <span className="sug-icon">{s.icon}</span>
                <span className="sug-title">{s.title}</span>
                <span className="sug-priority" style={{ 
                  color: getPriorityColor(s.priority), 
                  borderColor: getPriorityColor(s.priority),
                  background: `${getPriorityColor(s.priority)}10`
                }}>
                  {s.priority}
                </span>
              </div>
              <div className="sug-description">{s.description}</div>
              <div className="sug-action-row" style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="sug-impact">{s.impact}</span>
                    <span className="sug-action-label">— Action : {s.action}</span>
                </div>
              </div>
            </div>
            <div className="sug-btn-group">
                <button className="sug-btn execute">🎯 Appliquer</button>
                <button className="sug-btn ignore">Ignorer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
