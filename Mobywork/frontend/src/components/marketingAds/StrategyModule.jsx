import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3002/api/marketing';

export default function StrategyModule({ initialData = null }) {
  const [formData, setFormData] = useState({
    product: initialData?.product || '',
    target: initialData?.target || '',
    objective: initialData?.objective || 'conversion',
    tone: initialData?.tone || 'expert'
  });
  const [result, setResult] = useState(initialData?.result || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product) return;
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/strategy/generate`, formData);
      setResult(res.data);
    } catch (err) {
      console.error("Erreur stratégie:", err);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Formulaire de Stratégie */}
      <div className="db-card" style={{ width: '100%', background: 'linear-gradient(to bottom, var(--bg-surface), var(--bg-base))' }}>
        <div className="db-card-header">
          <div className="db-card-title">🎯 Configuration de la Stratégie Omnicanale</div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
              📦 Produit ou Service phare
            </label>
            <input 
              type="text" 
              className="mail-list-search"
              style={{ paddingLeft: '1rem', fontSize: '1rem', height: '48px', border: '1px solid var(--border-hover)' }} 
              placeholder="ex: Rénovation de Pont en Teck - Kit Complet Professionnel"
              value={formData.product}
              onChange={e => setFormData({ ...formData, product: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
              👥 Cible Prioritaire
            </label>
            <input 
              type="text" 
              className="mail-list-search"
              style={{ paddingLeft: '0.75rem', height: '42px' }} 
              placeholder="ex: Propriétaires de voiliers classiques"
              value={formData.target}
              onChange={e => setFormData({ ...formData, target: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Objectif Campagne
            </label>
            <select className="mail-list-search" style={{ paddingLeft: '0.75rem', appearance: 'none', background: 'var(--bg-elevated)' }} value={formData.objective} onChange={e => setFormData({ ...formData, objective: e.target.value })}>
              <option value="conversion">🚀 Ventes Directes</option>
              <option value="leads">📋 Génération de Devis</option>
              <option value="branding">🌟 Notoriété de Marque</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Ton de Communication
            </label>
            <select className="mail-list-search" style={{ paddingLeft: '0.75rem', appearance: 'none', background: 'var(--bg-elevated)' }} value={formData.tone} onChange={e => setFormData({ ...formData, tone: e.target.value })}>
              <option value="expert">Expert & Technique</option>
              <option value="luxe">Haut de Gamme / Luxe</option>
              <option value="plaisancier">Passionné / Proche</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="gs-autopilot-btn" disabled={loading || !formData.product} style={{ width: '100%', height: '42px' }}>
              {loading ? '⏳ Analyse IA en cours...' : '✨ Élaborer la Stratégie'}
            </button>
          </div>
        </form>
      </div>

      {/* RÉSULTATS DE LA STRATÉGIE */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
          
          {/* HEADER RÉSULTAT */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
              <div className="db-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), transparent)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>⚓ Concept Créatif Central</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>{result.angle}</div>
                  <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{result.hook}"</div>
              </div>
              <div className="db-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-green)' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-green)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>💰 Budget & Durée</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{result.budget_rec.daily}€ <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>/ jour</span></div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>{result.budget_rec.split}</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>⏳ {result.budget_rec.duration}</div>
              </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {/* ADS COMPONENT */}
              <div className="db-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="db-card-header" style={{ background: 'rgba(59,130,246,0.05)' }}>
                      <div className="db-card-title">📣 Publicités Payantes (Ads)</div>
                  </div>
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#4285f4', marginBottom: '0.5rem' }}>GOOGLE SEARCH ADS</label>
                          <div style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(66,133,244,0.2)' }}>
                              {result.ads.google.headlines.map((h, i) => (
                                <div key={i} style={{ color: '#4285f4', fontWeight: 700, fontSize: '0.9rem', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', paddingBottom: '4px', marginBottom: '4px' }}>{h}</div>
                              ))}
                              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '8px', lineHeight: 1.4 }}>{result.ads.google.descriptions[0]}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#e8f0fe', color: '#1967d2', borderRadius: '4px', fontWeight: 700 }}>{result.ads.google.cta}</span>
                                  <button onClick={() => copyToClipboard(result.ads.google.headlines.join('\n'), 'gads')} className="chart-period-btn">{copied === 'gads' ? 'Copié' : 'Copier tout'}</button>
                              </div>
                          </div>
                      </div>

                      <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#1877f2', marginBottom: '0.5rem' }}>META ADS (FB/IG)</label>
                          <div style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(24,119,242,0.2)' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{result.ads.meta.headline}</div>
                              <div style={{ fontSize: '0.82rem', lineHeight: 1.5, opacity: 0.9, whiteSpace: 'pre-wrap' }}>{result.ads.meta.longDescription}</div>
                              <button className="gtb-btn" style={{ width: '100%', marginTop: '1rem', background: '#1877f2', border: 'none', color: 'white', fontWeight: 700 }}>{result.ads.meta.cta}</button>
                          </div>
                      </div>
                  </div>
              </div>

              {/* SOCIAL COMPONENT */}
              <div className="db-card">
                  <div className="db-card-header" style={{ background: 'rgba(139,92,246,0.05)' }}>
                      <div className="db-card-title">📱 Réseaux Sociaux (Organique)</div>
                  </div>
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {[
                        { id: 'li', name: 'LinkedIn', color: '#0A66C2', text: result.social.linkedin },
                        { id: 'ig', name: 'Instagram', color: '#E1306C', text: result.social.instagram },
                        { id: 'fb', name: 'Facebook', color: '#1877F2', text: result.social.facebook },
                        { id: 'x', name: 'X / Twitter', color: '#14171A', text: result.social.twitter },
                      ].map(net => (
                        <div key={net.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: net.color }}>{net.name}</span>
                                <button onClick={() => copyToClipboard(net.text, net.id)} style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{copied === net.id ? 'Copié !' : 'Copier'}</button>
                            </div>
                            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.78rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{net.text}</div>
                        </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* AUDIENCE SEGMENTATION */}
          <div className="db-card">
              <div className="db-card-header" style={{ background: 'rgba(245,158,11,0.05)' }}>
                  <div className="db-card-title">🎯 Segmentation d'Audience Recommandée</div>
              </div>
              <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {result.audiences.map((aud, i) => (
                    <div key={i} style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--accent-orange)', marginBottom: '0.25rem' }}>{aud.segment}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.5rem' }}>Interêts : {aud.interests}</div>
                        <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>{aud.logic}</div>
                    </div>
                  ))}
              </div>
          </div>

          {/* STRATEGIC ADVICE */}
          <div className="db-card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.1))', padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ fontSize: '2rem' }}>💡</div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Conseils de l'IA pour la réussite</div>
                        <div style={{ fontSize: '0.95rem', fontStyle: 'italic', lineHeight: 1.6 }}>{result.strategyAdvice}</div>
                    </div>
                </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="ai-feed-loading" style={{ margin: '2rem auto' }}>
            <div className="gs-spinner"></div>
            <span>Synthèse de votre stratégie d'élite en cours...</span>
        </div>
      )}
    </div>
  );
}
