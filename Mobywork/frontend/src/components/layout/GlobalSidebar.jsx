import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Mail, Users, BarChart2, Megaphone,
  Bot, Settings, ChevronRight, Zap,
  TrendingUp, ShoppingCart, X, FileText
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_PUBLIC_URL = API_URL.replace(/\/api\/?$/, '/api-public');

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard IA',    icon: LayoutDashboard },
  { id: 'mail',        label: 'Emails',           icon: Mail            },
  { id: 'crm',         label: 'Clients CRM',      icon: Users           },
  { id: 'quotes',      label: 'Devis',            icon: FileText        },
  { id: 'orders',      label: 'Commandes',        icon: ShoppingCart    },
  { id: 'finance',     label: 'Finance IA',       icon: BarChart2       },
  { id: 'marketing',   label: 'Marketing IA',     icon: Megaphone,      badge: 'ADS', badgeColor: '#6366f1' },
  { id: 'prospection', label: 'Prospection IA',   icon: TrendingUp,     badge: 'NEW', badgeColor: '#10b981' },
  { id: 'autopilot',   label: 'Automatisation',   icon: Bot,            badge: 'IA',  badgeColor: '#8b5cf6' },
  { id: 'settings',    label: 'Paramètres',        icon: Settings       },
];

async function checkServices() {
  const results = { backend: false, imap: false, prestashop: false };
  try {
    await axios.get(`${API_PUBLIC_URL}/health`, { timeout: 3000 });
    results.backend = true;
  } catch {}
  try {
    const r = await axios.get(`${API_URL}/settings/status`, { timeout: 3000 });
    results.imap = r.data?.imap === true;
    results.prestashop = r.data?.prestashop === true;
  } catch {
    results.imap = results.backend;
  }
  return results;
}

export default function GlobalSidebar({
  activeModule, onModuleChange, onAutopilot, isAutopiloting,
  user, emailUnread = 0, dashboardBadge = 0,
  // Props transmises depuis App pour le contrôle mobile
  mobileOpen = false, onMobileClose = () => {},
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [serviceStatus, setServiceStatus] = useState({ backend: false, imap: false, prestashop: false });

  useEffect(() => {
    const check = async () => {
      const s = await checkServices();
      setServiceStatus(s);
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Fermer la sidebar mobile quand on change de module
  const handleNavClick = useCallback((id) => {
    onModuleChange(id);
    onMobileClose(); // ferme sur mobile
  }, [onModuleChange, onMobileClose]);

  // Fermer avec Escape sur mobile
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && mobileOpen) onMobileClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  const getInitials = (u) => {
    if (!u) return 'PP';
    const name = u.nom || u.name || u.username || '';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase() || u.email?.substring(0, 2).toUpperCase() || 'PP';
  };
  const getUserName = (u) => u?.nom || u?.name || u?.username || 'Paul Picard';
  const getUserRole = (u) => {
    const role = u?.role === 'admin' ? 'Admin' : u?.role || 'Admin';
    const company = u?.company || 'RenovBoat';
    return `${role} · ${company}`;
  };

  const STATUS_DOTS = [
    { label: 'Backend Node.js', ok: serviceStatus.backend },
    { label: 'OVH Mail IMAP',   ok: serviceStatus.imap   },
    { label: 'PrestaShop API',  ok: serviceStatus.prestashop },
  ];

  const getBadge = (item) => {
    if (item.id === 'mail' && emailUnread > 0) return { value: emailUnread, color: '#3b82f6' };
    if (item.id === 'dashboard' && dashboardBadge > 0) return { value: dashboardBadge, color: '#ef4444' };
    if (item.badge) return { value: item.badge, color: item.badgeColor };
    return null;
  };

  // Sidebar CSS class
  const sidebarClass = [
    'global-sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* ── OVERLAY MOBILE ────────────────────────────────────── */}
      <div
        className={`gs-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={sidebarClass}>

        {/* Bouton fermeture mobile */}
        <button className="gs-close-btn" onClick={onMobileClose} title="Fermer">
          <X size={14} />
        </button>

        {/* ── LOGO ─────────────────────────────────────────── */}
        <div className="gs-logo">
          <div className="gs-logo-icon">
            <span>⚓</span>
          </div>
          {!collapsed && (
            <div className="gs-logo-text">
              <span className="gs-logo-title">MobyWorkspace</span>
              <span className="gs-logo-badge">IA BETA</span>
            </div>
          )}
          <button
            className="gs-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title="Réduire le menu"
          >
            <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s' }} />
          </button>
        </div>

        {/* ── BOUTON AUTO-PILOTE ────────────────────────────── */}
        <div className="gs-autopilot-wrap">
          <button
            className={`gs-autopilot-btn ${isAutopiloting ? 'running' : ''}`}
            onClick={onAutopilot}
            disabled={isAutopiloting}
            title="Lancer l'Auto-Pilote IA"
          >
            <Zap size={15} fill="currentColor" />
            {!collapsed && <span>{isAutopiloting ? 'Analyse en cours...' : 'Auto-Pilote IA'}</span>}
            {isAutopiloting && <span className="gs-spinner" />}
          </button>
        </div>

        {/* ── NAVIGATION ───────────────────────────────────── */}
        <nav className="gs-nav">
          {!collapsed && <span className="gs-section-label">Navigation</span>}
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const badge = getBadge(item);
            return (
              <button
                key={item.id}
                className={`gs-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={17} className="gs-nav-icon" />
                {!collapsed && <span className="gs-nav-label">{item.label}</span>}
                {badge && (
                  <span
                    className="gs-nav-badge"
                    style={{ background: `${badge.color}22`, color: badge.color, borderColor: `${badge.color}44` }}
                  >
                    {badge.value}
                  </span>
                )}
                {collapsed && badge && (
                  <span className="gs-nav-badge-dot" style={{ background: badge.color }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── STATUTS SERVEUR ───────────────────────────────── */}
        {!collapsed && (
          <div className="gs-status-block">
            <span className="gs-section-label">Statut système</span>
            {STATUS_DOTS.map(s => (
              <div
                key={s.label}
                className="gs-status-row"
                title={s.ok ? 'Connecté et fonctionnel' : 'Erreur de connexion / Clé API manquante'}
              >
                <span className={`gs-status-dot ${s.ok ? 'ok' : 'err'}`} />
                <span className="gs-status-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── PROFIL UTILISATEUR ───────────────────────────── */}
        <div className="gs-user" title={getUserRole(user)}>
          <div className="gs-user-avatar">{getInitials(user)}</div>
          {!collapsed && (
            <div className="gs-user-info">
              <span className="gs-user-name">{getUserName(user)}</span>
              <span className="gs-user-role">{getUserRole(user)}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
