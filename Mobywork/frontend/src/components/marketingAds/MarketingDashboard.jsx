import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, Legend
} from 'recharts';

export default function MarketingDashboard({ data, refresh }) {
  if (!data) return null;
  const { kpis, history, settings } = data;

  const MetricCard = ({ label, value, icon, color, delta, prefix = '', suffix = '' }) => (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-card-top">
        <div className="stat-card-icon" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        {delta && (
          <div className={`stat-card-delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div className="stat-card-value">
        {prefix}{value.toLocaleString()}{suffix}
      </div>
      <div className="stat-card-label">{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '-0.8rem' }}>
          {settings && (
              <div style={{ padding: '3px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                  🎯 Objectif ROAS : {settings.targetRoas}x
              </div>
          )}
          <div style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', fontSize: '0.72rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }}></span>
              Données Temps Réel (PrestaShop)
          </div>
      </div>
      {/* KPI Cards */}
      <div className="stats-bar" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <MetricCard 
          label="Dépenses Totales" 
          value={kpis.totalSpent} 
          icon="💰" 
          color="#ef4444" 
          suffix=" €" 
          delta={+4.2}
        />
        <MetricCard 
          label="ROAS Global" 
          value={kpis.roas} 
          icon="📈" 
          color="#10b981" 
          suffix="x" 
          delta={+12}
        />
        <MetricCard 
          label="CPC Moyen" 
          value={kpis.cpcMoyen} 
          icon="🖱️" 
          color="#3b82f6" 
          suffix=" €" 
          delta={-2.5}
        />
        <MetricCard 
          label="CTR Moyen" 
          value={kpis.ctrMoyen} 
          icon="👁️" 
          color="#8b5cf6" 
          suffix=" %" 
          delta={+0.8}
        />
        <MetricCard 
          label="Conversions" 
          value={kpis.totalConversions} 
          icon="🎯" 
          color="#f59e0b" 
          delta={+8}
        />
        <MetricCard 
          label="Coût/Conversion" 
          value={kpis.costPerConversion} 
          icon="💸" 
          color="#6366f1" 
          suffix=" €" 
          delta={-5}
        />
      </div>

      {/* Charts Row */}
      <div className="dashboard-main-grid">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Évolution Dépenses & Conversions</div>
              <div className="chart-subtitle">Analyse comparative sur les 30 derniers jours</div>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%', minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  tickFormatter={(str) => str.split('-').slice(2).join('/')}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="spent" name="Dépenses (€)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSpent)" strokeWidth={2} />
                <Area type="monotone" dataKey="revenue" name="CA (€)" stroke="#10b981" fill="none" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">ROAS Quotidien</div>
              <div className="chart-subtitle">Performance du retour sur investissement</div>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%', minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  tickFormatter={(str) => str.split('-').slice(2).join('/')}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="roas" name="ROAS" stroke="#8b5cf6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performing Channels (Simulated) */}
      <div className="db-card">
        <div className="db-card-header">
          <div className="db-card-title">Performance par Canal</div>
        </div>
        <div className="segments-list">
          {[
            { label: 'Google Search', count: '1,245€', pct: 45, color: '#3b82f6' },
            { label: 'Meta Ads (FB/IG)', count: '982€', pct: 35, color: '#8b5cf6' },
            { label: 'Google Display', count: '412€', pct: 15, color: '#6366f1' },
            { label: 'Autres (Ads)', count: '142€', pct: 5, color: '#94a3b8' }
          ].map(row => (
            <div key={row.label} className="seg-row">
              <div className="seg-dot" style={{ background: row.color }}></div>
              <div className="seg-label">{row.label}</div>
              <div className="seg-bar-wrap">
                <div className="seg-bar-fill" style={{ width: `${row.pct}%`, background: row.color }}></div>
              </div>
              <div className="seg-count">{row.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
