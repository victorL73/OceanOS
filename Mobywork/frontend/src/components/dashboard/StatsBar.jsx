import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShoppingCart, Users, Euro, Percent, RefreshCw } from 'lucide-react';
import axios from 'axios';

const EMPTY_STATS = {
  revenue: 0,
  revenueYesterday: 0,
  orders: 0,
  ordersYesterday: 0,
  newClients: 0,
  newClientsYesterday: 0,
  conversionRate: 0,
  conversionYesterday: 0,
};

function StatCard({ icon: Icon, label, value, yesterday, format = 'number', color, isLoading, compareLabel = 'vs hier' }) {
  const delta = (yesterday && yesterday > 0) ? ((value - yesterday) / yesterday) * 100 : 0;
  const isUp = delta >= 0;

  const fmt = (v) => {
    if (v === undefined || v === null) return '...';
    if (format === 'currency') return `${v.toLocaleString('fr-FR')}€`;
    if (format === 'percent')  return `${v.toFixed(1)}%`;
    return v.toLocaleString('fr-FR');
  };

  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-card-icon" style={{ background: `${color}18`, color }}>
          {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Icon size={18} />}
        </div>
        {!isLoading && (
            <div className={`stat-card-delta ${isUp ? 'up' : 'down'}`}>
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(delta).toFixed(1)}%
            </div>
        )}
      </div>
      <div className="stat-card-value">{isLoading ? '...' : fmt(value)}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-compare">{isLoading ? '...' : `${compareLabel} : ${fmt(yesterday)}`}</div>
    </div>
  );
}

export default function StatsBar() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState('day'); // 'day' | 'month' | 'year'

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('moby_token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || '/api'}/dashboard/stats?range=${range}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data);
      } catch (err) {
        console.error("Erreur stats dashboard:", err);
        setStats(EMPTY_STATS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [range]);

  const LABELS = {
    day: { ca: "CA du jour", cmp: "vs hier" },
    month: { ca: "CA du mois", cmp: "vs mois dernier" },
    year: { ca: "CA de l'année", cmp: "vs année dernière" }
  };
  const activeLabel = LABELS[range] || LABELS.day;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '4px' }}>
          {['day', 'month', 'year'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', border: 'none',
                background: range === r ? 'var(--bg-glass)' : 'transparent',
                color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: range === r ? 600 : 400,
                fontSize: '0.85rem'
              }}
            >
              {r === 'day' ? "Aujourd'hui" : r === 'month' ? 'Ce mois' : 'Cette année'}
            </button>
          ))}
        </div>
      </div>
      <div className="stats-bar" style={{ marginBottom: 0 }}>
        <StatCard
          icon={Euro}
          label={activeLabel.ca}
          value={stats?.revenue}
          yesterday={stats?.revenueYesterday}
          compareLabel={activeLabel.cmp}
          format="currency"
          color="#3b82f6"
          isLoading={isLoading}
        />
        <StatCard
          icon={ShoppingCart}
          label="Commandes"
          value={stats?.orders}
          yesterday={stats?.ordersYesterday}
          compareLabel={activeLabel.cmp}
          color="#10b981"
          isLoading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Nouveaux clients"
          value={stats?.newClients}
          yesterday={stats?.newClientsYesterday}
          compareLabel={activeLabel.cmp}
          color="#8b5cf6"
          isLoading={isLoading}
        />
        <StatCard
          icon={Percent}
          label="Taux de conversion"
          value={stats?.conversionRate}
          yesterday={stats?.conversionYesterday}
          compareLabel={activeLabel.cmp}
          format="percent"
          color="#f59e0b"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
