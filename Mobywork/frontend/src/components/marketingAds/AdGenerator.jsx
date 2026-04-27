import React, { useState } from 'react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/marketing`;

export default function AdGenerator({ onConvertToSocial }) {
  const [formData, setFormData] = useState({
    product: '',
    target: '',
    objective: 'conversion',
    platform: 'google'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product) return;
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/generate-ad`, formData);
      setResult(res.data);
    } catch (err) {
      console.error("Erreur génération pub:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Formulaire */}
      <div className="db-card">
        <div className="db-card-header">
          <div className="db-card-title">✍️ Paramètres de la Publicité</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Produit ou Service
            </label>
            <input 
              type="text" 
              className="mail-list-search"
              style={{ paddingLeft: '0.75rem' }} 
              placeholder="ex: Winch Lewmar 44ST Self-Tailing"
              value={formData.product}
              onChange={e => setFormData({ ...formData, product: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Cible / Audience
            </label>
            <input 
              type="text" 
              className="mail-list-search"
              style={{ paddingLeft: '0.75rem' }} 
              placeholder="ex: Plaisanciers propriétaires, 35-65 ans"
              value={formData.target}
              onChange={e => setFormData({ ...formData, target: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Objectif
              </label>
              <select 
                className="mail-list-search" 
                style={{ paddingLeft: '0.75rem', appearance: 'none', background: 'var(--bg-elevated)' }}
                value={formData.objective}
                onChange={e => setFormData({ ...formData, objective: e.target.value })}
              >
                <option value="conversion">Conversion</option>
                <option value="trafic">Trafic</option>
                <option value="branding">Notoriété</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Plateforme
              </label>
              <select 
                className="mail-list-search" 
                style={{ paddingLeft: '0.75rem', appearance: 'none', background: 'var(--bg-elevated)' }}
                value={formData.platform}
                onChange={e => setFormData({ ...formData, platform: e.target.value })}
              >
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="gs-autopilot-btn" 
            disabled={loading || !formData.product}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? '⏳ Génération...' : '✨ Générer la publicité'}
          </button>
        </form>
      </div>

      {/* Résultat */}
      <div className="db-card" style={{ minHeight: '400px' }}>
        {!result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: '4rem' }}>
            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</span>
            <div style={{ fontWeight: 600 }}>Prêt à rédiger votre publicité ?</div>
            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
                Remplissez les paramètres à gauche pour obtenir un contenu optimisé par l'IA.
            </div>
          </div>
        )}

        {loading && (
          <div className="ai-feed-loading" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span>L'IA rédige vos textes publicitaires...</span>
            <div className="ai-feed-loading-bar"></div>
          </div>
        )}

        {result && !loading && (
          <div className="module-scroll" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="db-card-header">
              <div className="db-card-title">✅ Publicité Générée</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-blue)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Headlines suggérées (Titres)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {result.headlines.map((h, i) => (
                    <div key={i} className="tp-row" style={{ background: 'var(--bg-elevated)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                        <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700 }}>{h}</div>
                        <button onClick={() => copyToClipboard(h, `h${i}`)} className="gtb-btn" style={{ fontSize: '0.7rem' }}>
                            {copied === `h${i}` ? '✔️' : '📋'}
                        </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-blue)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Description / Corps de texte
                </label>
                <div className="tp-row" style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: '8px', position: 'relative' }}>
                    <div style={{ fontSize: '0.88rem', lineHeight: 1.6, flex: 1 }}>{result.longDescription}</div>
                    <button 
                        onClick={() => copyToClipboard(result.longDescription, 'desc')} 
                        className="gtb-btn" 
                        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
                    >
                        {copied === 'desc' ? '✔️' : '📋'}
                    </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-green)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                        Angles Marketing
                    </label>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {result.angles.map((a, i) => (
                            <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '1rem', position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 0, color: 'var(--accent-green)' }}>•</span> {a}
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-orange)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                        Mots-Clés ciblés
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {result.keywords.map((k, i) => (
                            <span key={i} style={{ padding: '2px 8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{k}</span>
                        ))}
                    </div>
                </div>
              </div>
              
              <div style={{ padding: '0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--accent-indigo)', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-indigo)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    💡 Conseil de Ciblage IA
                </label>
                <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>{result.targetingTips}</div>
              </div>

              <button 
                onClick={() => onConvertToSocial({ 
                    product: formData.product, 
                    target: formData.target, 
                    objective: formData.objective 
                })}
                className="gs-autopilot-btn"
                style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))', border: 'none' }}
              >
                🎁 Créer les posts réseaux sociaux associés
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
