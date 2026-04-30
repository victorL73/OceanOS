import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PenTool } from 'lucide-react';

// Layout
import GlobalSidebar from './components/layout/GlobalSidebar';
import TopBar from './components/layout/TopBar';

// Modules
import DashboardLayout from './components/dashboard/DashboardLayout';
import CRMLayout from './components/crm/CRMLayout';
import QuotesLayout from './components/quotes/QuotesLayout';
import OrdersLayout from './components/orders/OrdersLayout';
import ComposeMailModal from './components/ComposeMailModal';
import Sidebar from './components/Sidebar';
import MailList from './components/MailList';
import MailDetail from './components/MailDetail';
import SettingsModule from './components/settings/SettingsModule';
import FinanceDashboard from './components/finance/FinanceDashboard';
import MarketingModule from './components/marketingAds/MarketingModule';
import ProspectionLayout from './components/prospection/ProspectionLayout';
import AutopilotModule from './components/autopilot/AutopilotModule';
import CommandPalette from './components/ui/CommandPalette';
import { useToast } from './components/ui/ToastProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const OCEANOS_URL = '/OceanOS/';
const OCEANOS_AUTH_URL = '/OceanOS/api/auth.php';
const OCEANOS_MOBY_TOKEN_URL = '/OceanOS/api/mobywork-token.php';
const MODULE_IDS = new Set([
  'dashboard',
  'mail',
  'crm',
  'quotes',
  'orders',
  'marketing',
  'prospection',
  'autopilot',
  'finance',
  'settings',
]);

const initialToken = localStorage.getItem('moby_token');
if (initialToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Intercepteur global pour attraper les 401 et forcer la déconnexion
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session expirée ou token invalide. Déconnexion...');
      localStorage.removeItem('moby_token');
      localStorage.removeItem('moby_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

const FILTER_MAP = {
  inbox:      { categorie: 'tous',       status: 'a_repondre' },
  urgent:     { categorie: 'tous',       priorite: 'urgent'   },
  client:     { categorie: 'client',     status: 'tous'       },
  facture:    { categorie: 'facture',    status: 'tous'       },
  newsletter: { categorie: 'newsletter', status: 'tous'       },
  treated:    { categorie: 'tous',       status: 'traite'     },
  archive:    { categorie: 'tous',       status: 'archive'    },
  sent:       { folder: 'sent' },
};

function redirectToOceanOS() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(`${OCEANOS_URL}?next=${encodeURIComponent(next)}`);
}

async function fetchOceanOSMobyToken() {
  const response = await fetch(OCEANOS_MOBY_TOKEN_URL, { credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token || !payload.user) return null;
  return payload;
}

function getInitialModule() {
  const moduleParam = new URLSearchParams(window.location.search).get('module');
  return MODULE_IDS.has(moduleParam) ? moduleParam : 'dashboard';
}

function updateBrowserModuleUrl(moduleName, context = null) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('module', moduleName);

    ['quote', 'id', 'source', 'client_id', 'client_name', 'client_email', 'nav_ts'].forEach((key) => {
      url.searchParams.delete(key);
    });

    if (context) {
      if (context.id) url.searchParams.set('id', context.id);
      if (moduleName === 'quotes' && context.id === 'new') url.searchParams.set('quote', 'new');
      if (context.source) url.searchParams.set('source', context.source);
      if (context.client_id !== undefined && context.client_id !== null) url.searchParams.set('client_id', String(context.client_id));
      if (context.client_name) url.searchParams.set('client_name', context.client_name);
      if (context.client_email) url.searchParams.set('client_email', context.client_email);
      url.searchParams.set('nav_ts', String(Date.now()));
    }

    window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {}
}

// ─── COMPOSANT MODULE MAIL (inchangé fonctionnellement) ────────────────────
function MailModule({ onCompose, isComposing, setIsComposing, navContext, setNavContext }) {
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({ urgents: 0, a_traiter: 0, factures: 0, traites: 0 });
  const [selectedMail, setSelectedMail] = useState(null);
  const [activeFilter, setActiveFilter] = useState('inbox');
  const [selectedMailbox, setSelectedMailbox] = useState('all');
  const [mailboxes, setMailboxes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchMailboxes = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/mailboxes`);
      const list = Array.isArray(res.data) ? res.data : [];
      setMailboxes(list);
      setSelectedMailbox(prev => prev === 'all' || list.some(box => box.id === prev) ? prev : 'all');
    } catch (err) {
      console.error('Erreur chargement boites mail:', err.message);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const filter = FILTER_MAP[activeFilter] || FILTER_MAP.inbox;
      const params = { search: searchTerm };
      if (filter.folder) params.folder = filter.folder;
      if (selectedMailbox && selectedMailbox !== 'all') params.mailbox = selectedMailbox;
      if (filter.categorie && filter.categorie !== 'tous') params.categorie = filter.categorie;
      if (filter.status    && filter.status    !== 'tous') params.status    = filter.status;
      if (filter.priorite)                                  params.priorite  = filter.priorite;
      const [emailsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/emails`, { params }),
        axios.get(`${API_URL}/stats`),
      ]);
      setEmails(emailsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Backend non accessible:', err.message);
    }
  }, [activeFilter, searchTerm, selectedMailbox]);

  useEffect(() => {
    if (navContext && navContext.id) {
      // Pour forcer l'affichage de l'email même s'il n'est pas dans le filtre actif
      // on essaie de le trouver
      const loadMailDirectly = async () => {
         try {
           const res = await axios.get(`${API_URL}/emails/${navContext.id}`);
           setSelectedMail(res.data);
           setNavContext(null);
         } catch(e) { }
      }
      loadMailDirectly();
    }
  }, [navContext, setNavContext]);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => {
      fetchData();
      fetchMailboxes();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchData, fetchMailboxes]);

  useEffect(() => {
    fetchMailboxes();
  }, [fetchMailboxes]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (!selectedMail) return;
      if (e.key.toLowerCase() === 't') handleUpdateStatus(selectedMail.id, 'traite');
      if (e.key.toLowerCase() === 'a') handleUpdateStatus(selectedMail.id, 'archive');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedMail]);

  const handleUpdateStatus = async (id, status) => {
    try {
      await axios.patch(`${API_URL}/emails/${id}/status`, { status });
      if (selectedMail?.id === id) setSelectedMail(null);
      await fetchData();
      await fetchMailboxes();
    } catch (err) { console.error('Erreur mise à jour statut'); }
  };

  const handleMailUpdated = (updatedMail) => {
    setSelectedMail(updatedMail);
    setEmails(prev => prev.map(m => m.id === updatedMail.id ? updatedMail : m));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await axios.post(`${API_URL}/sync`);
      await fetchData();
      await fetchMailboxes();
    } catch (err) {
      console.error('Erreur synchronisation OVH:', err.message);
      alert("Erreur lors de la synchronisation OVH. Vérifiez le backend et la configuration mail.");
    }
    finally { setIsSyncing(false); }
  };

  return (
    <div className={`app-content mail-layout ${selectedMail ? 'has-selection' : ''}`}>
      <Sidebar
        activeFilter={activeFilter}
        onFilterChange={(f) => { setActiveFilter(f); setSelectedMail(null); }}
        stats={stats}
        mailboxes={mailboxes}
        selectedMailbox={selectedMailbox}
        onMailboxChange={(mailboxId) => { setSelectedMailbox(mailboxId); setSelectedMail(null); }}
        isSyncing={isSyncing}
        onSync={handleSync}
        onCompose={onCompose}
      />
      <div className="mail-slider-wrapper">
        <div className={`mail-inner-slider ${selectedMail ? 'has-selection' : ''}`}>
          <MailList
            mails={emails}
            selectedMailId={selectedMail?.id}
            onSelectMail={setSelectedMail}
            onSync={handleSync}
            isSyncing={isSyncing}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
          />
          <MailDetail
            mail={selectedMail}
            onMarkDone={(id) => handleUpdateStatus(id, 'traite')}
            onArchive={(id) => handleUpdateStatus(id, 'archive')}
            onBack={() => setSelectedMail(null)}
            onReply={async (id, msg) => {
              try {
                await axios.post(`${API_URL}/emails/${id}/reply`, { message: msg });
                setSelectedMail(null);
                await fetchData();
                await fetchMailboxes();
              } catch { alert('Erreur lors de l\'envoi.'); }
            }}
            onMailUpdated={() => handleMailUpdated(selectedMail)}
          />
        </div>
      </div>
      {isComposing && (
        <ComposeMailModal
          onClose={() => setIsComposing(false)}
          onSent={() => { setIsComposing(false); fetchData(); fetchMailboxes(); }}
        />
      )}

      {/* Floating Action Button for Mobile Compose */}
      <div className="fab-container">
        <button className="fab-btn" onClick={() => onCompose()} title="Nouveau message">
          <PenTool size={24} />
        </button>
      </div>
    </div>
  );
}

// ─── PLACEHOLDER MODULE ──────────────────────────────────────────────────────
function ComingSoonModule({ name }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)', padding: '3rem'
    }}>
      <div style={{ fontSize: '3rem' }}>🚧</div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{name}</h2>
      <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Ce module est bientôt disponible.</p>
    </div>
  );
}

// ─── APP PRINCIPALE ──────────────────────────────────────────────────────────
function OceanOSRedirect() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#071018',
      color: '#edf7f9',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div>
        <div style={{
          width: 46,
          height: 46,
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 1rem',
          background: 'linear-gradient(135deg, #38a3ff, #1fd1b2)',
          color: '#041018',
          fontWeight: 900
        }}>O</div>
        <h1 style={{ fontSize: '1.35rem', margin: '0 0 0.5rem' }}>Connexion OceanOS</h1>
        <p style={{ color: '#8fa7b0', margin: '0 0 1.25rem' }}>Redirection vers le portail central...</p>
        <button
          type="button"
          onClick={redirectToOceanOS}
          style={{
            border: '1px solid rgba(198,221,230,0.2)',
            borderRadius: 8,
            minHeight: 42,
            padding: '0 14px',
            background: '#132231',
            color: '#edf7f9',
            fontWeight: 800
          }}
        >
          Ouvrir OceanOS
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const toast = useToast();
  const [token, setToken] = useState(localStorage.getItem('moby_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('moby_user') || 'null'));

  const [activeModule, setActiveModule] = useState(getInitialModule);
  const [navContext, setNavContext] = useState(null);
  const [isAutopiloting, setIsAutopiloting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [emailUnread, setEmailUnread] = useState(0);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    axios.get(`${API_URL}/auth/me`)
      .then((res) => {
        if (cancelled || !res.data?.user) return;
        localStorage.setItem('moby_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [token]);

  const handleGlobalNavigate = (moduleName, context = null) => {
    setNavContext(context);
    setActiveModule(moduleName);
    updateBrowserModuleUrl(moduleName, context);
  };

  const handleModuleChange = (moduleName) => {
    setNavContext(null);
    setActiveModule(moduleName);
    updateBrowserModuleUrl(moduleName);
  };

  // Cmd+K keyboard shortcut (Ctrl/Cmd + Shift + K pour éviter le conflit navigateur)
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);


  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/suggestions`);
      const mapped = res.data.map(s => ({
        id: s.id,
        icon: s.icon,
        text: s.title
      }));
      setNotifications(mapped);
    } catch (err) {
      console.error('Erreur chargement notifications');
    }
  }, []);

  useEffect(() => {
    if (token) fetchNotifications();
  }, [token, fetchNotifications]);

  // Fetch unread email count
  const fetchEmailUnread = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/stats`);
      setEmailUnread(res.data?.a_traiter || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (token) {
      fetchEmailUnread();
      const id = setInterval(fetchEmailUnread, 30_000);
      return () => clearInterval(id);
    }
  }, [token, fetchEmailUnread]);

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('moby_token', newToken);
    localStorage.setItem('moby_user', JSON.stringify(newUser));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
  };

  useEffect(() => {
    if (token) return;

    let cancelled = false;
    fetchOceanOSMobyToken()
      .then((payload) => {
        if (cancelled) return;
        if (payload) {
          handleLogin(payload.token, payload.user);
          return;
        }
        redirectToOceanOS();
      })
      .catch(() => {
        if (!cancelled) redirectToOceanOS();
      });

    return () => { cancelled = true; };
  }, [token]);

  const handleLogout = async () => {
    localStorage.removeItem('moby_token');
    localStorage.removeItem('moby_user');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    try {
      await fetch(OCEANOS_AUTH_URL, { method: 'DELETE', credentials: 'include' });
    } catch {}
    window.location.href = OCEANOS_URL;
  };

  if (!token) {
    return <OceanOSRedirect />;
  }

  const handleAutopilot = async () => {
    setIsAutopiloting(true);
    try {
      const res = await axios.post(`${API_URL}/autopilot`);
      toast.success('Auto-Pilote IA', res.data?.message || 'Traitement automatique effectué.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'Auto-Pilote. Vérifiez les prérequis (Clés API).';
      toast.error('Auto-Pilote IA', msg);
    } finally {
      setIsAutopiloting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try { 
      await axios.post(`${API_URL}/sync`); 
      await fetchNotifications();
      await fetchEmailUnread();
      toast.success('Synchronisation', 'Données mises à jour avec succès.');
    } catch {
      toast.error('Synchronisation', 'Impossible de synchroniser. Vérifiez votre connexion.');
    } finally { setIsSyncing(false); }
  };

  const handleClearNotifications = async () => {
    try {
      const ids = notifications.map(n => n.id);
      await axios.post(`${API_URL}/dashboard/dismiss-all-suggestions`, { suggestionIds: ids });
      setNotifications([]);
    } catch (err) {
      console.error('Erreur vidage notifications');
    }
  };

  // Navigation depuis le Feed IA
  const handleModuleNavFromDashboard = (module) => {
    const map = { email: 'mail', crm: 'crm', nautipost: 'marketing', dashboard: 'dashboard' };
    handleModuleChange(map[module] || 'dashboard');
  };

  const renderModule = () => {
    const content = (() => {
      switch (activeModule) {
        case 'dashboard':
          return (
            <div className="module-scroll">
              <DashboardLayout onModuleNav={handleModuleNavFromDashboard} />
            </div>
          );
        case 'mail':
          return (
            <MailModule
              onCompose={() => setIsComposing(true)}
              isComposing={isComposing}
              setIsComposing={setIsComposing}
              navContext={navContext}
              setNavContext={setNavContext}
            />
          );
        case 'crm':
          return <CRMLayout navContext={navContext} setNavContext={setNavContext} onGlobalNavigate={handleGlobalNavigate} />;
        case 'quotes':
          return <QuotesLayout navContext={navContext} setNavContext={setNavContext} onGlobalNavigate={handleGlobalNavigate} />;
        case 'orders':
          return <OrdersLayout navContext={navContext} setNavContext={setNavContext} />;
        case 'marketing':
          return <MarketingModule />;
        case 'prospection':
          return <ProspectionLayout />;
        case 'autopilot':
          return (
            <div className="module-scroll">
              <AutopilotModule />
            </div>
          );
        case 'finance':
          return (
            <div className="module-scroll">
              <FinanceDashboard />
            </div>
          );
        case 'settings':
          return (
            <div className="module-scroll">
              <SettingsModule user={user} onLogout={handleLogout} />
            </div>
          );
        default:
          return <ComingSoonModule name={activeModule} />;
      }
    })();
    return <ErrorBoundary key={activeModule}>{content}</ErrorBoundary>;
  };

  const isMailModule = activeModule === 'mail';

  return (
    <div className="app-shell">
      <GlobalSidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onAutopilot={handleAutopilot}
        isAutopiloting={isAutopiloting}
        user={user}
        emailUnread={emailUnread}
        dashboardBadge={notifications.length}
        mobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="app-main-area">
        <TopBar
          activeModule={activeModule}
          onSync={handleSync}
          isSyncing={isSyncing}
          notifications={notifications}
          onClearNotifications={handleClearNotifications}
          onGlobalNavigate={handleGlobalNavigate}
          onOpenCommandPalette={() => setIsCmdOpen(true)}
          onMobileMenuOpen={() => setIsMobileMenuOpen(true)}
        />
        <div className="app-content-wrapper">
          {renderModule()}
        </div>
      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        onNavigate={(module) => { handleModuleChange(module); setIsCmdOpen(false); }}
        onCompose={() => { setIsComposing(true); setIsCmdOpen(false); }}
        onSync={() => { handleSync(); setIsCmdOpen(false); }}
      />
    </div>
  );
}

