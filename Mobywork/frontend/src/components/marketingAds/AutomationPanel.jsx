import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3002/api/marketing';

export default function AutomationPanel() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/rules`);
      setRules(res.data);
    } catch (err) {
      console.error("Erreur fetching rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await axios.patch(`${API_URL}/rules/${id}/toggle`);
      fetchRules();
    } catch (err) {
      console.error("Erreur toggle rule:", err);
    }
  };

  if (loading) return <div>Chargement des règles...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
      {/* Liste des règles existantes en format cartes */}
      {rules.map(rule => (
        <div key={rule.id} className="db-card" style={{ 
          borderLeft: `4px solid ${rule.enabled ? 'var(--accent-green)' : 'var(--text-muted)'}`,
          opacity: rule.enabled ? 1 : 0.7
        }}>
          <div className="db-card-header">
            <div className="db-card-title">{rule.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: rule.enabled ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {rule.enabled ? 'ACTIF' : 'INACTIF'}
                </span>
                <label className="switch" style={{ cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={rule.enabled === 1} 
                        onChange={() => handleToggle(rule.id)}
                        style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                    />
                </label>
            </div>
          </div>
          
          <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Si <strong>{rule.condition_metric.toUpperCase()}</strong> est {rule.condition_operator} <strong>{rule.condition_value}</strong>
            </div>
            <div style={{ 
                padding: '0.6rem 0.875rem', 
                background: 'var(--bg-elevated)', 
                borderRadius: '8px', 
                fontSize: '0.8rem',
                border: '1px solid var(--border)'
            }}>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>→ Action : </span>
                {rule.action_type.replace('_', ' ')} {rule.action_value && `(${rule.action_value}%)`}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Mode: {rule.mode === 'auto' ? '🚀 Automatique' : rule.mode === 'semi_auto' ? '🤝 Semi-Auto' : '👤 Manuel'}</span>
                <span>Dernier déclenchement: {rule.last_triggered ? new Date(rule.last_triggered).toLocaleDateString() : 'Jamais'}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Ajouter une nouvelle règle (Placeholder visuel) */}
      <div className="db-card" style={{ 
          border: '2px dashed var(--border-hover)', 
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          cursor: 'pointer'
      }}>
          <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤖</span>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Créer une règle automatique</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
              Optimisez votre budget sans intervention humaine
          </p>
      </div>
    </div>
  );
}
