import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Bot, Zap, Mail, Clock, CheckCircle2, XCircle, AlertTriangle,
  Play, Pause, RefreshCw, Archive, Tag, Star, Bell, Filter,
  ChevronRight, ToggleLeft, ToggleRight, Activity, TrendingUp,
  Shield, Eye, Settings, Plus, Trash2, Edit3
} from 'lucide-react';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}`;

// Règles d'automatisation prédéfinies
const DEFAULT_RULES = [
  {
    id: 'auto_archive_noreply',
    name: 'Archivage No-Reply',
    description: 'Archive automatiquement les emails provenant de no-reply, newsletter ou notifications automatiques.',
    icon: <Archive size={18} />,
    iconColor: '#64748b',
    category: 'emails',
    trigger: 'Nouvel email de no-reply/newsletter',
    action: 'Archiver automatiquement',
    enabled: true,
    stats: { executions: 47, lastRun: '2025-04-14T18:00:00', saved: '2h30' }
  },
  {
    id: 'auto_tag_facture',
    name: 'Détection Factures',
    description: 'Détecte et catégorise automatiquement les emails contenant des factures ou bons de commande.',
    icon: <Tag size={18} />,
    iconColor: '#3b82f6',
    category: 'emails',
    trigger: 'Email avec "facture", "invoice", "bon de commande"',
    action: 'Catégoriser → Facture',
    enabled: true,
    stats: { executions: 23, lastRun: '2025-04-14T16:30:00', saved: '45min' }
  },
  {
    id: 'auto_urgent_client',
    name: 'Urgence Clients',
    description: 'Marque comme urgent les emails de clients VIP ou contenant des mots-clés critiques.',
    icon: <AlertTriangle size={18} />,
    iconColor: '#ef4444',
    category: 'emails',
    trigger: 'Email client avec "urgent", "problème", "réclamation"',
    action: 'Marquer Urgent + Notification',
    enabled: true,
    stats: { executions: 8, lastRun: '2025-04-13T14:20:00', saved: '30min' }
  },
  {
    id: 'auto_relance_crm',
    name: 'Relance CRM Inactifs',
    description: 'Identifie les clients inactifs depuis 90+ jours et les ajoute à la file de relance.',
    icon: <Clock size={18} />,
    iconColor: '#f59e0b',
    category: 'crm',
    trigger: 'Client inactif depuis 90+ jours',
    action: 'Ajouter à file de relance',
    enabled: false,
    stats: { executions: 12, lastRun: '2025-04-10T09:00:00', saved: '1h15' }
  },
  {
    id: 'auto_panier_abandon',
    name: 'Rappel Paniers Abandonnés',
    description: 'Détecte les paniers abandonnés PrestaShop et génère des alertes pour intervention.',
    icon: <Bell size={18} />,
    iconColor: '#8b5cf6',
    category: 'orders',
    trigger: 'Panier abandonné > 48h',
    action: 'Créer alerte Dashboard',
    enabled: true,
    stats: { executions: 31, lastRun: '2025-04-14T12:00:00', saved: '2h00' }
  },
  {
    id: 'auto_vip_detection',
    name: 'Détection VIP',
    description: 'Surveille les clients dont le CA dépasse 1000€ et upgrade leur statut automatiquement.',
    icon: <Star size={18} />,
    iconColor: '#10b981',
    category: 'crm',
    trigger: 'Client CA > 1000€',
    action: 'Upgrader statut → VIP',
    enabled: true,
    stats: { executions: 5, lastRun: '2025-04-12T08:00:00', saved: '20min' }
  },
];

// Activité récente
const RECENT_ACTIVITY = [
  { id: 1, rule: 'Archivage No-Reply', time: 'Il y a 2 heures', count: 3, icon: <Archive size={14} />, color: '#64748b' },
  { id: 2, rule: 'Détection Factures', time: 'Aujourd\'hui à 14:30', count: 1, icon: <Tag size={14} />, color: '#3b82f6' },
  { id: 3, rule: 'Rappel Paniers', time: 'Aujourd\'hui à 12:00', count: 2, icon: <Bell size={14} />, color: '#8b5cf6' },
  { id: 4, rule: 'Archivage No-Reply', time: 'Hier à 18:00', count: 7, icon: <Archive size={14} />, color: '#64748b' },
  { id: 5, rule: 'Détection VIP', time: 'Il y a 2 jours', count: 1, icon: <Star size={14} />, color: '#10b981' },
];

export default function AutopilotModule() {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [isRunningAutopilot, setIsRunningAutopilot] = useState(false);
  const [lastRunResult, setLastRunResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState('tous');

  const totalExecutions = rules.reduce((s, r) => s + r.stats.executions, 0);
  const enabledCount = rules.filter(r => r.enabled).length;

  const toggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleRunAutopilot = async () => {
    setIsRunningAutopilot(true);
    setLastRunResult(null);
    try {
      const res = await axios.post(`${API_URL}/autopilot`);
      setLastRunResult({ success: true, message: res.data?.message || 'Traitement effectué avec succès.' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'exécution.';
      setLastRunResult({ success: false, message: msg });
    } finally {
      setIsRunningAutopilot(false);
    }
  };

  const categories = [
    { id: 'tous', label: 'Toutes les règles', count: rules.length },
    { id: 'emails', label: 'Emails', count: rules.filter(r => r.category === 'emails').length },
    { id: 'crm', label: 'CRM', count: rules.filter(r => r.category === 'crm').length },
    { id: 'orders', label: 'Commandes', count: rules.filter(r => r.category === 'orders').length },
  ];

  const filteredRules = activeCategory === 'tous' ? rules : rules.filter(r => r.category === activeCategory);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── HEADER ──────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} color="white" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Automatisation IA
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  {enabledCount} règle{enabledCount > 1 ? 's' : ''} active{enabledCount > 1 ? 's' : ''} · {totalExecutions} exécutions totales
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {lastRunResult && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1rem', borderRadius: 8,
                background: lastRunResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${lastRunResult.success ? '#10b981' : '#ef4444'}`,
                color: lastRunResult.success ? '#10b981' : '#ef4444',
                fontSize: '0.8rem', fontWeight: 600
              }}>
                {lastRunResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {lastRunResult.message}
              </div>
            )}
            <button
              onClick={handleRunAutopilot}
              disabled={isRunningAutopilot}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 1.25rem', borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: 'white', border: 'none', cursor: isRunningAutopilot ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.9rem', opacity: isRunningAutopilot ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(139,92,246,0.35)', transition: 'all 0.2s'
              }}
            >
              {isRunningAutopilot
                ? <><RefreshCw size={15} className="animate-spin" /> Exécution...</>
                : <><Zap size={15} fill="currentColor" /> Lancer Auto-Pilote</>
              }
            </button>
          </div>
        </div>

        {/* ── KPI CARDS ────────────────────────────────── */}
        <div className="autopilot-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Règles actives', value: enabledCount, sub: `sur ${rules.length} configurées`, icon: <Shield size={18} />, color: '#8b5cf6' },
            { label: 'Exécutions', value: totalExecutions, sub: 'depuis l\'activation', icon: <Activity size={18} />, color: '#3b82f6' },
            { label: 'Temps économisé', value: '7h15', sub: 'estimé ce mois', icon: <Clock size={18} />, color: '#10b981' },
            { label: 'Emails traités', value: 78, sub: 'automatiquement', icon: <Mail size={18} />, color: '#f59e0b' },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '1.25rem', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                <div style={{ width: 32, height: 32, background: `${kpi.color}15`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                  {kpi.icon}
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>{kpi.sub}</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${kpi.color}, transparent)` }} />
            </div>
          ))}
        </div>

        {/* ── CONTENU PRINCIPAL ─────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>

          {/* RÈGLES */}
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid',
                    borderColor: activeCategory === cat.id ? 'var(--accent-blue)' : 'var(--border)',
                    background: activeCategory === cat.id ? 'rgba(59,130,246,0.1)' : 'var(--bg-surface)',
                    color: activeCategory === cat.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}
                >
                  {cat.label}
                  <span style={{
                    background: activeCategory === cat.id ? 'var(--accent-blue)' : 'var(--border)',
                    color: activeCategory === cat.id ? 'white' : 'var(--text-muted)',
                    borderRadius: 10, padding: '0 6px', fontSize: '0.7rem', fontWeight: 700
                  }}>{cat.count}</span>
                </button>
              ))}
            </div>

            {/* Liste des règles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredRules.map(rule => (
                <div
                  key={rule.id}
                  style={{
                    background: 'var(--bg-surface)', border: `1px solid ${rule.enabled ? 'var(--border)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '1.25rem',
                    opacity: rule.enabled ? 1 : 0.6,
                    transition: 'all 0.2s',
                    borderLeft: `3px solid ${rule.enabled ? rule.iconColor : 'var(--border)'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${rule.iconColor}15`, color: rule.iconColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {rule.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{rule.name}</h3>
                        <button
                          onClick={() => toggleRule(rule.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.enabled ? rule.iconColor : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          {rule.enabled
                            ? <><ToggleRight size={22} /> Active</>
                            : <><ToggleLeft size={22} /> Inactive</>
                          }
                        </button>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>{rule.description}</p>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                          <Filter size={12} style={{ color: rule.iconColor }} />
                          <span><b>SI :</b> {rule.trigger}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                          <ChevronRight size={12} style={{ color: rule.iconColor }} />
                          <span><b>ALORS :</b> {rule.action}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>✅ {rule.stats.executions} exécution(s)</span>
                        <span>⏱️ {rule.stats.saved} économisées</span>
                        <span>🕐 Dernière : {new Date(rule.stats.lastRun).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Bouton ajouter règle */}
              <button style={{
                width: '100%', padding: '1rem', borderRadius: 12,
                border: '2px dashed var(--border)', background: 'transparent',
                color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600,
                fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', transition: 'all 0.2s'
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Plus size={16} /> Créer une règle personnalisée
              </button>
            </div>
          </div>

          {/* ACTIVITÉ RÉCENTE */}
          <div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} style={{ color: 'var(--accent-blue)' }} /> Activité récente
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {RECENT_ACTIVITY.map(act => (
                  <div key={act.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${act.color}15`, color: act.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      {act.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{act.rule}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{act.time}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: act.color, background: `${act.color}15`, padding: '2px 8px', borderRadius: 6 }}>+{act.count}</div>
                  </div>
                ))}
              </div>

              {/* Stats rapides */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.85rem 0' }}>Performance</h4>
                {[
                  { label: 'Taux de succès', value: '98.5%', color: '#10b981' },
                  { label: 'Erreurs', value: '1', color: '#ef4444' },
                  { label: 'Emails archivés', value: '47', color: '#64748b' },
                ].map((stat, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{stat.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div style={{ marginTop: '1rem', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', color: '#8b5cf6', fontWeight: 700, fontSize: '0.85rem' }}>
                <Bot size={15} /> Auto-Pilote IA
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Le bouton "Lancer Auto-Pilote" exécute toutes les règles actives manuellement. Les règles s'exécutent aussi automatiquement toutes les 3 minutes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
