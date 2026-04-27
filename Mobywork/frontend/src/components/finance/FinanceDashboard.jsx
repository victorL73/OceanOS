import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Euro, TrendingUp, AlertTriangle, ShieldAlert, Sparkles, RefreshCw, BarChart2 } from 'lucide-react';

const API_URL = 'http://localhost:3002/api';

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981'];

export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('moby_token');
      const res = await axios.get(`${API_URL}/finance/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      setError("Impossible de charger les données financières. Vérifiez le backend.");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('moby_token');
      const res = await axios.post(`${API_URL}/finance/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message || 'Synchronisation terminée.');
      await fetchDashboard();
    } catch (err) {
      alert("Erreur lors de la synchronisation.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem('moby_token');
      const res = await axios.post(`${API_URL}/finance/analyze`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInsights(res.data);
    } catch (err) {
      alert("Erreur de l'IA. Elle est probablement indisponible.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div style={{ padding: '2rem', background: '#ef444422', color: '#ef4444', borderRadius: '8px' }}>
          <AlertTriangle size={24} style={{ marginBottom: '1rem' }} />
          <h3>Erreur Finance</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <RefreshCw className="animate-spin text-3xl mb-4" />
        <p>Chargement des métriques financières...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="finance-dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 color="#10b981" /> Dashboard Prédictif
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Aggrégation intelligente : Ventes Prestashop & Factures e-mails</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            Sync Mails
          </button>
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#10b981', color: '#0f172a', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            <Sparkles size={16} fill="currentColor" />
            {isAnalyzing ? "Analyse CFO en cours..." : "Analyser la situation"}
          </button>
        </div>
      </div>

      {/* ── INSIGHTS IA ────────────────────────────────────────────── */}
      {insights && (
        <div style={{ padding: '20px', background: 'var(--bg-elevated)', borderRadius: '12px', borderLeft: '4px solid #10b981', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '1.2rem', margin: 0 }}>
              <Sparkles /> Résumé Exécutif CFO
            </h3>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', background: insights.riskLevel === 'Élevé' ? '#ef444433' : insights.riskLevel === 'Moyen' ? '#f59e0b33' : '#10b98133', color: insights.riskLevel === 'Élevé' ? '#ef4444' : insights.riskLevel === 'Moyen' ? '#f59e0b' : '#10b981' }}>
              Risque : {insights.riskLevel}
            </span>
          </div>
          <p style={{ lineHeight: '1.6', marginBottom: '20px', fontSize: '1.05rem' }}>{insights.summary}</p>
          
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><ShieldAlert size={16} /> Points d'Anomalie</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                {insights.anomalies.map((a, i) => <li key={i} style={{ marginBottom: '5px' }}>{a}</li>)}
              </ul>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><TrendingUp size={16} /> Actions Recommandées</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                {insights.recommendations.map((a, i) => <li key={i} style={{ marginBottom: '5px' }}>{a}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div className="finance-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {[
          { label: "Chiffre d'Affaires Brut", value: data.totalRevenue, color: '#3b82f6' },
          { label: "Charges Détectées", value: data.totalExpenses, color: '#ef4444' },
          { label: "Bénéfice Net Estimé", value: data.beneficeNetEstime, color: '#10b981' },
          { label: "Cashflow Disponible", value: data.currentCashflow, color: '#8b5cf6' }
        ].map(k => (
          <div key={k.label} style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: '12px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{k.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{k.value.toLocaleString('fr-FR')} €</div>
          </div>
        ))}
      </div>

      {/* ── GRAPHIQUES ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', minHeight: '350px' }}>
        
        {/* Graphique Area Trésorerie */}
        <div style={{ background: 'var(--bg-elevated)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem' }}>Dynamique de Trésorerie & CA</h3>
          <div style={{ flex: 1, minHeight: '250px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData}>
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(str) => str.slice(5)} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="cashflow" stroke="#10b981" fillOpacity={1} fill="url(#colorCash)" name="Trésorerie" />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="CA Quotidien" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique Pie Charges */}
        <div style={{ background: 'var(--bg-elevated)', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem' }}>Répartition des Charges</h3>
          <div style={{ flex: 1, minHeight: '250px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} formatter={(val) => `${val} €`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
            {data.pieData.map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></span>
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── LISTE DES CHARGES (CRUD) ───────────────────────────────── */}
      <div style={{ background: 'var(--bg-elevated)', padding: '1.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Euro size={18} color="#f59e0b" /> Historique et Gestion des Charges
          </h3>
          <button 
            onClick={() => {
              const amount = prompt("Montant de la charge (€) :");
              if (!amount) return;
              const supplier = prompt("Fournisseur / Nom de la charge :");
              if (!supplier) return;
              const category = prompt("Catégorie (hébergement, fournisseur, marketing, abonnement, autre) :", "autre");
              const date = prompt("Date (YYYY-MM-DD) :", new Date().toISOString().split('T')[0]);
              
              const token = localStorage.getItem('moby_token');
              axios.post(`${API_URL}/finance/expenses`, { amount: parseFloat(amount), supplier, category, date }, { headers: { Authorization: `Bearer ${token}` } })
                .then(() => fetchDashboard())
                .catch(err => alert("Erreur lors de l'ajout."));
            }}
            style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            + Nouvelle Charge Manuelle
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <th style={{ padding: '10px' }}>Date</th>
                <th style={{ padding: '10px' }}>Fournisseur</th>
                <th style={{ padding: '10px' }}>Catégorie</th>
                <th style={{ padding: '10px' }}>Montant</th>
                <th style={{ padding: '10px' }}>Source</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data.expenses || []).length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune charge détectée.</td>
                </tr>
              ) : (
                data.expenses.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '10px' }}>{exp.date}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{exp.supplier}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '4px 8px', background: 'var(--bg-app)', borderRadius: '12px', fontSize: '0.8rem' }}>{exp.category}</span>
                    </td>
                    <td style={{ padding: '10px', color: '#ef4444', fontWeight: '500' }}>{exp.amount} €</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: exp.source === 'auto' ? '#3b82f622' : '#f59e0b22',
                        color: exp.source === 'auto' ? '#3b82f6' : '#f59e0b',
                        border: `1px solid ${exp.source === 'auto' ? '#3b82f644' : '#f59e0b44'}`
                      }}>
                        {exp.source === 'auto' ? '🤖 IA' : '✏️ Manuel'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Retirer la charge de ${exp.supplier} ?`)) {
                            const token = localStorage.getItem('moby_token');
                            axios.delete(`${API_URL}/finance/expenses/${exp.id}`, { headers: { Authorization: `Bearer ${token}` } })
                              .then(() => fetchDashboard())
                              .catch(() => alert("Erreur de suppression."));
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
