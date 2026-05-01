import React, { useState } from 'react';
import { Sun, Moon, RefreshCw, ChevronRight, Menu } from 'lucide-react';
import GlobalSearch from './GlobalSearch';

const BREADCRUMBS = {
  dashboard: ['MobyWorkspace', 'Dashboard IA'],
  mail: ['MobyWorkspace', 'Gestion Emails'],
  crm: ['MobyWorkspace', 'CRM Clients'],
  orders: ['MobyWorkspace', 'Commandes'],
  ventes: ['MobyWorkspace', 'Analyse des Ventes'],
  marketing: ['MobyWorkspace', 'Marketing - NautiPost'],
  autopilot: ['MobyWorkspace', 'Automatisation IA'],
  settings: ['MobyWorkspace', 'Parametres'],
  finance: ['MobyWorkspace', 'Finance IA'],
  prospection: ['MobyWorkspace', 'Prospection IA'],
};

const MODULE_ICONS = {
  dashboard: 'DA',
  mail: 'EM',
  crm: 'CRM',
  orders: 'CO',
  finance: 'FI',
  marketing: 'MK',
  autopilot: 'IA',
  settings: 'PA',
  prospection: 'PR',
};

export default function TopBar({
  activeModule,
  onSync,
  isSyncing,
  onGlobalNavigate,
  onOpenCommandPalette,
  onMobileMenuOpen,
}) {
  const [dark, setDark] = useState(true);
  const crumbs = BREADCRUMBS[activeModule] || ['MobyWorkspace'];
  const moduleIcon = MODULE_ICONS[activeModule] || 'MW';

  return (
    <header className="global-topbar">
      <button
        className="gs-hamburger"
        onClick={onMobileMenuOpen}
        title="Ouvrir la navigation"
        aria-label="Menu"
      >
        <Menu size={18} />
      </button>

      <div className="gtb-breadcrumb">
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb}>
            {index > 0 && <ChevronRight size={12} style={{ opacity: 0.35, margin: '0 4px' }} />}
            <span style={{ opacity: index === crumbs.length - 1 ? 1 : 0.5, fontWeight: index === crumbs.length - 1 ? 600 : 400 }}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="gtb-mobile-title">
        <span>{moduleIcon}</span>
        <span>{crumbs[crumbs.length - 1]}</span>
      </div>

      <div className="gtb-search-center">
        <GlobalSearch onNavigate={onGlobalNavigate} />
      </div>

      <div className="gtb-date">
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

      <div className="gtb-actions">
        <button
          className="gtb-btn"
          onClick={onSync}
          disabled={isSyncing}
          title="Synchroniser les donnees"
        >
          <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
        </button>

        <button
          className="gtb-btn"
          onClick={() => {
            const newDark = !dark;
            setDark(newDark);
            document.body.setAttribute('data-theme', newDark ? 'dark' : 'light');
          }}
          title="Changer le theme"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button
          className="gtb-btn-add"
          onClick={onOpenCommandPalette}
          title="Ouvrir la palette de commandes (Ctrl+Shift+K)"
          style={{ gap: '0.5rem', paddingRight: '0.6rem' }}
        >
          <span style={{ fontSize: '0.78rem' }}>Commandes</span>
          <span style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '18px' }}>Ctrl</kbd>
            <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '18px' }}>Shift</kbd>
            <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '18px' }}>K</kbd>
          </span>
        </button>
      </div>
    </header>
  );
}
