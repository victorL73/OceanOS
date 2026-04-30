import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sun, Moon, RefreshCw, ChevronRight, X, Menu } from 'lucide-react';
import GlobalSearch from './GlobalSearch';

const BREADCRUMBS = {
  dashboard:   ['MobyWorkspace', 'Dashboard IA'],
  mail:        ['MobyWorkspace', 'Gestion Emails'],
  crm:         ['MobyWorkspace', 'CRM Clients'],
  orders:      ['MobyWorkspace', 'Commandes'],
  ventes:      ['MobyWorkspace', 'Analyse des Ventes'],
  marketing:   ['MobyWorkspace', 'Marketing · NautiPost'],
  autopilot:   ['MobyWorkspace', 'Automatisation IA'],
  settings:    ['MobyWorkspace', 'Paramètres'],
  finance:     ['MobyWorkspace', 'Finance IA'],
  prospection: ['MobyWorkspace', 'Prospection IA'],
};

const MODULE_ICONS = {
  dashboard: '📊', mail: '📧', crm: '👥', orders: '🛒',
  finance: '📈', marketing: '📣', autopilot: '🤖', settings: '⚙️', prospection: '🎯',
};

export default function TopBar({
  activeModule, onSync, isSyncing,
  notifications = [], onClearNotifications,
  onGlobalNavigate, onOpenCommandPalette,
  onMobileMenuOpen, // NEW: handler hamburger
}) {
  const [dark, setDark] = useState(true);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);

  // Fermer le panneau notif en cliquant à l'extérieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const crumbs = BREADCRUMBS[activeModule] || ['MobyWorkspace'];
  const handleNotificationClick = (notification) => {
    if (!notification?.module || !onGlobalNavigate) return;
    onGlobalNavigate(notification.module, notification.context || null);
    setShowNotif(false);
  };
  const moduleIcon = MODULE_ICONS[activeModule] || '📋';

  return (
    <header className="global-topbar">

      {/* ── HAMBURGER (mobile) ─────────────────────────────── */}
      <button
        className="gs-hamburger"
        onClick={onMobileMenuOpen}
        title="Ouvrir la navigation"
        aria-label="Menu"
      >
        <Menu size={18} />
      </button>

      {/* ── BREADCRUMB (desktop/tablet) ─────────────────────── */}
      <div className="gtb-breadcrumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} style={{ opacity: 0.35, margin: '0 4px' }} />}
            <span style={{ opacity: i === crumbs.length - 1 ? 1 : 0.5, fontWeight: i === crumbs.length - 1 ? 600 : 400 }}>
              {c}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* ── MODULE TITLE (mobile uniquement) ───────────────── */}
      <div className="gtb-mobile-title">
        <span>{moduleIcon}</span>
        <span>{crumbs[crumbs.length - 1]}</span>
      </div>

      {/* ── RECHERCHE GLOBALE ──────────────────────────────── */}
      <div className="gtb-search-center">
        <GlobalSearch onNavigate={onGlobalNavigate} />
      </div>

      {/* ── DATE (desktop) ──────────────────────────────────── */}
      <div className="gtb-date">
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

      {/* ── ACTIONS ────────────────────────────────────────── */}
      <div className="gtb-actions">
        {/* Sync */}
        <button
          className="gtb-btn"
          onClick={onSync}
          disabled={isSyncing}
          title="Synchroniser les données"
        >
          <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="gtb-btn"
            onClick={() => setShowNotif(!showNotif)}
            title="Notifications"
          >
            <Bell size={15} />
            {notifications.length > 0 && (
              <span className="gtb-notif-badge">{notifications.length}</span>
            )}
          </button>

          {showNotif && (
            <div className="gtb-notif-panel">
              <div className="gtb-notif-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Notifications</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {notifications.length > 0 && (
                    <span onClick={onClearNotifications} style={{ cursor: 'pointer', color: 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>Tout vider</span>
                  )}
                  <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>✅ Aucune notification</p>
              ) : notifications.map((n, i) => (
                <div
                  key={n.id || i}
                  className="gtb-notif-item"
                  onClick={() => handleNotificationClick(n)}
                  role={n.module ? 'button' : undefined}
                  style={{ cursor: n.module ? 'pointer' : 'default' }}
                >
                  <span>{n.icon}</span>
                  <span>{n.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thème */}
        <button
          className="gtb-btn"
          onClick={() => {
            const newDark = !dark;
            setDark(newDark);
            document.body.setAttribute('data-theme', newDark ? 'dark' : 'light');
          }}
          title="Changer le thème"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Cmd+Shift+K — Command Palette (masqué sur mobile via CSS) */}
        <button
          className="gtb-btn-add"
          onClick={onOpenCommandPalette}
          title="Ouvrir la palette de commandes (Ctrl+Shift+K)"
          style={{ gap: '0.5rem', paddingRight: '0.6rem' }}
        >
          <span style={{ fontSize: '0.78rem' }}>Commandes</span>
          <span style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '18px' }}>Ctrl</kbd>
            <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '18px' }}>⇧</kbd>
            <kbd style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '0px 5px', fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '18px' }}>K</kbd>
          </span>
        </button>
      </div>
    </header>
  );
}
