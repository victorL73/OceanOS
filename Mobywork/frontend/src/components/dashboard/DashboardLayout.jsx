import React from 'react';
import StatsBar from './StatsBar';
import SalesChart from './SalesChart';
import AiFeedPanel from './AiFeedPanel';
import TopProducts from './TopProducts';
import AlertsPanel from './AlertsPanel';

export default function DashboardLayout({ onModuleNav }) {
  return (
    <div className="dashboard-layout">
      {/* ── STATS BAR ─────────────────────────────────── */}
      <StatsBar />

      {/* ── FEED IA + GRAPHIQUE (2 colonnes) ───────────── */}
      <div className="dashboard-main-grid">
        <AiFeedPanel onModuleNav={onModuleNav} />
        <SalesChart />
      </div>

      {/* ── TOP PRODUITS ──────────────────────────────── */}
      <TopProducts />

      {/* ── ALERTES + SEGMENTS + EMAIL ACTIVITÉ ────────── */}
      <AlertsPanel />
    </div>
  );
}
