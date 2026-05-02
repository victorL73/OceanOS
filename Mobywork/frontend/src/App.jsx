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
  inbox:      { categorie: 'tous',       status: 'a_repondre', unfiled: true },
  urgent:     { categorie: 'tous',       priorite: 'urgent'   },
  client:     { categorie: 'client',     status: 'tous'       },
  facture:    { categorie: 'facture',    status: 'tous'       },
  newsletter: { categorie: 'newsletter', status: 'tous'       },
  treated:    { categorie: 'tous',       status: 'traite',     unfiled: true },
  archive:    { categorie: 'tous',       status: 'archive',    unfiled: true },
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

function getInitialNavContext() {
  const id = new URLSearchParams(window.location.search).get('id');
  return id ? { id } : null;
}

function refreshOceanOSNotifications() {
  window.dispatchEvent(new CustomEvent('oceanos:notifications-refresh'));
  if (window.OceanOSNotifications?.refresh) {
    window.OceanOSNotifications.refresh();
  }
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
  const [mailFolders, setMailFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedMailIds, setSelectedMailIds] = useState([]);
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const activeFolderId = activeFilter.startsWith('folder:') ? activeFilter.replace('folder:', '') : null;

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

  const fetchFolders = useCallback(async () => {
    try {
      const params = {};
      if (selectedMailbox && selectedMailbox !== 'all') params.mailbox = selectedMailbox;
      const res = await axios.get(`${API_URL}/mail-folders`, { params });
      const list = Array.isArray(res.data) ? res.data : [];
      setMailFolders(list);
      if (activeFolderId && !list.some(folder => String(folder.id) === String(activeFolderId))) {
        setActiveFilter('inbox');
      }
    } catch (err) {
      console.error('Erreur chargement dossiers mail:', err.message);
    }
  }, [activeFolderId, selectedMailbox]);

  const fetchData = useCallback(async () => {
    try {
      const currentFolderId = activeFilter.startsWith('folder:') ? activeFilter.replace('folder:', '') : null;
      const filter = currentFolderId ? {} : (FILTER_MAP[activeFilter] || FILTER_MAP.inbox);
      const params = { search: searchTerm };
      if (currentFolderId) params.folderId = currentFolderId;
      if (filter.folder) params.folder = filter.folder;
      if (selectedMailbox && selectedMailbox !== 'all') params.mailbox = selectedMailbox;
      if (filter.categorie && filter.categorie !== 'tous') params.categorie = filter.categorie;
      if (filter.status    && filter.status    !== 'tous') params.status    = filter.status;
      if (filter.priorite)                                  params.priorite  = filter.priorite;
      if (filter.unfiled)                                    params.unfiled   = '1';
      const [emailsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/emails`, { params }),
        axios.get(`${API_URL}/stats`),
      ]);
      const nextEmails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
      setEmails(nextEmails);
      setStats(statsRes.data);
      setSelectedMailIds(prev => prev.filter(id => nextEmails.some(mail => mail.id === id)));
      setSelectedMail(prev => prev && nextEmails.some(mail => mail.id === prev.id) ? prev : null);
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
      fetchFolders();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchData, fetchMailboxes, fetchFolders]);

  useEffect(() => {
    fetchMailboxes();
    fetchFolders();
  }, [fetchMailboxes, fetchFolders]);

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
      await fetchFolders();
    } catch (err) { console.error('Erreur mise à jour statut'); }
  };

  const handleMailUpdated = (updatedMail) => {
    setSelectedMail(updatedMail);
    setEmails(prev => prev.map(m => m.id === updatedMail.id ? updatedMail : m));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const syncRes = await axios.post(`${API_URL}/sync`);
      if (syncRes.data?.success === false && syncRes.data?.errors?.length) {
        console.warn('Synchronisation OVH avec erreurs:', syncRes.data.errors);
        alert(`Synchronisation OVH terminee avec erreur : ${syncRes.data.errors[0]}`);
      }
      await fetchData();
      await fetchMailboxes();
      await fetchFolders();
    } catch (err) {
      console.error('Erreur synchronisation OVH:', err.message);
      const apiError = err.response?.data?.errors?.[0] || err.response?.data?.error;
      alert(apiError || "Erreur lors de la synchronisation OVH. Vérifiez le backend et la configuration mail.");
    }
    finally { setIsSyncing(false); }
  };

  const handleToggleMailSelection = (id, checked) => {
    setSelectedMailIds(prev => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter(item => item !== id);
    });
  };

  const handleSelectAllVisible = () => {
    const visibleIds = emails.map(mail => mail.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedMailIds.includes(id));
    setSelectedMailIds(allSelected ? [] : visibleIds);
  };

  const refreshAfterBulk = async () => {
    setSelectedMailIds([]);
    if (selectedMail && selectedMailIds.includes(selectedMail.id)) setSelectedMail(null);
    await fetchData();
    await fetchMailboxes();
    await fetchFolders();
  };

  const handleBulkStatus = async (status) => {
    if (selectedMailIds.length === 0) return;
    setIsBulkBusy(true);
    try {
      await axios.patch(`${API_URL}/emails/bulk/status`, { ids: selectedMailIds, status });
      await refreshAfterBulk();
    } catch (err) {
      alert(err.response?.data?.error || 'Action groupee impossible.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMailIds.length === 0 || activeFilter !== 'archive') return;
    const ok = window.confirm(`Supprimer definitivement ${selectedMailIds.length} mail(s) archive(s) ? Cette action est irreversible.`);
    if (!ok) return;

    setIsBulkBusy(true);
    try {
      await axios.delete(`${API_URL}/emails/bulk`, { data: { ids: selectedMailIds } });
      await refreshAfterBulk();
    } catch (err) {
      alert(err.response?.data?.error || 'Suppression definitive impossible.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleCreateFolder = async () => {
    let mailboxId = selectedMailbox;
    if (mailboxId === 'all') {
      if (mailboxes.length === 1) {
        mailboxId = mailboxes[0].id;
      } else {
        alert('Selectionnez une boite mail avant de creer un dossier partage.');
        return;
      }
    }

    const name = window.prompt('Nom du nouveau dossier');
    if (!name || !name.trim()) return;

    try {
      await axios.post(`${API_URL}/mail-folders`, { name: name.trim(), mailbox: mailboxId });
      await fetchFolders();
    } catch (err) {
      alert(err.response?.data?.error || 'Creation du dossier impossible.');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    const folder = mailFolders.find(item => String(item.id) === String(folderId));
    const ok = window.confirm(`Supprimer le dossier "${folder?.name || ''}" ? Les mails resteront dans la boite.`);
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/mail-folders/${folderId}`);
      if (String(activeFolderId) === String(folderId)) setActiveFilter('inbox');
      await fetchFolders();
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Suppression du dossier impossible.');
    }
  };

  const handleBulkFolder = async (folderId) => {
    if (selectedMailIds.length === 0) return;
    setIsBulkBusy(true);
    try {
      const targetFolderId = folderId === '__none' ? null : folderId;
      const res = await axios.patch(`${API_URL}/emails/bulk/folder`, {
        ids: selectedMailIds,
        folderId: targetFolderId,
      });
      if (Number(res.data?.skipped || 0) > 0) {
        alert(`${res.data.skipped} mail(s) ignores car ils ne correspondent pas a la boite de ce dossier.`);
      }
      await refreshAfterBulk();
      await fetchFolders();
    } catch (err) {
      alert(err.response?.data?.error || 'Classement dans le dossier impossible.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  const handleDropMail = async (target, ids = []) => {
    const mailIds = Array.from(new Set(ids.map(Number).filter(Number.isFinite)));
    if (mailIds.length === 0) return;

    setIsBulkBusy(true);
    try {
      if (target.type === 'folder') {
        const res = await axios.patch(`${API_URL}/emails/bulk/folder`, {
          ids: mailIds,
          folderId: target.folderId,
        });
        if (Number(res.data?.skipped || 0) > 0) {
          alert(`${res.data.skipped} mail(s) ignores car ils ne correspondent pas a la boite de ce dossier.`);
        }
      } else {
        if (target.clearFolder) {
          await axios.patch(`${API_URL}/emails/bulk/folder`, { ids: mailIds, folderId: null });
        }
        if (target.type === 'inbox') {
          await axios.patch(`${API_URL}/emails/bulk/status`, { ids: mailIds, status: 'a_repondre' });
        } else if (target.type === 'status' && target.status) {
          await axios.patch(`${API_URL}/emails/bulk/status`, { ids: mailIds, status: target.status });
        }
      }

      setSelectedMailIds(prev => prev.filter(id => !mailIds.includes(Number(id))));
      if (selectedMail && mailIds.includes(Number(selectedMail.id))) setSelectedMail(null);
      await fetchData();
      await fetchMailboxes();
      await fetchFolders();
    } catch (err) {
      alert(err.response?.data?.error || 'Deplacement du mail impossible.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  return (
    <div className={`app-content mail-layout ${selectedMail ? 'has-selection' : ''}`}>
      <Sidebar
        activeFilter={activeFilter}
        onFilterChange={(f) => { setActiveFilter(f); setSelectedMail(null); setSelectedMailIds([]); }}
        stats={stats}
        mailboxes={mailboxes}
        selectedMailbox={selectedMailbox}
        onMailboxChange={(mailboxId) => { setSelectedMailbox(mailboxId); setSelectedMail(null); setSelectedMailIds([]); }}
        isSyncing={isSyncing}
        onSync={handleSync}
        onCompose={onCompose}
        folders={mailFolders}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onDropMail={handleDropMail}
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
            onSearch={(value) => { setSearchTerm(value); setSelectedMailIds([]); }}
            activeFilter={activeFilter}
            selectedIds={selectedMailIds}
            isBulkBusy={isBulkBusy}
            onToggleSelect={handleToggleMailSelection}
            onSelectAll={handleSelectAllVisible}
            onBulkStatus={handleBulkStatus}
            onBulkDelete={handleBulkDelete}
            onBulkFolder={handleBulkFolder}
            folders={mailFolders}
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
                await fetchFolders();
              } catch { alert('Erreur lors de l\'envoi.'); }
            }}
            onMailUpdated={(updatedMail) => handleMailUpdated(updatedMail || selectedMail)}
          />
        </div>
      </div>
      {isComposing && (
        <ComposeMailModal
          onClose={() => setIsComposing(false)}
          onSent={() => { setIsComposing(false); fetchData(); fetchMailboxes(); fetchFolders(); }}
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
  const [navContext, setNavContext] = useState(getInitialNavContext);
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
      const mapped = res.data
        .filter(s => s && s.notify !== false && s.id !== 'sug_idle')
        .map(s => ({
          id: s.id,
          icon: s.icon,
          text: s.title,
          module: s.module === 'email' ? 'mail' : s.module,
          context: s.emailId ? { id: s.emailId } : null
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
      const syncRes = await axios.post(`${API_URL}/sync`); 
      await fetchNotifications();
      await fetchEmailUnread();
      refreshOceanOSNotifications();
      if (syncRes.data?.success === false && syncRes.data?.errors?.length) {
        toast.warning('Synchronisation', syncRes.data.errors[0]);
      } else {
        toast.success('Synchronisation', 'Données mises à jour avec succès.');
      }
    } catch (err) {
      const msg = err.response?.data?.errors?.[0] || err.response?.data?.error || 'Impossible de synchroniser. Vérifiez votre connexion.';
      toast.error('Synchronisation', msg);
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
        dashboardBadge={0}
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

