import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Save, LogOut, CheckCircle, AlertCircle, Mail, Key, Users, UserPlus, User, Bell, Bot, FileText, ShoppingBag, Trash2, BarChart2, Image, Eye, TrendingUp, Plus } from 'lucide-react';
import {
  INVOCEAN_QUOTE_TEMPLATE,
  QUOTE_TEMPLATE_VARS,
  buildQuotePreviewHtml,
  getQuoteTemplate,
} from '../quotes/invoceanQuoteTemplate';

const API = import.meta.env.VITE_API_URL || '/api';

const inputStyle = {
  width: '100%', padding: '0.75rem 1rem',
  background: 'var(--bg-app, var(--bg-elevated))',
  border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text-primary)',
  fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
};

const toggleStyle = (active) => ({
  width: '42px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
  background: active ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-elevated)',
  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
  outline: '1px solid var(--border)',
});

const toggleDot = (active) => ({
  position: 'absolute', width: '18px', height: '18px', borderRadius: '50%',
  background: 'white', top: '3px', left: active ? '21px' : '3px',
  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
});

function Toggle({ checked, onChange }) {
  return (
    <button style={toggleStyle(checked)} onClick={() => onChange(!checked)}>
      <span style={toggleDot(checked)} />
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.4rem' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{hint}</p>}
    </div>
  );
}

function Grid2({ children }) {
  return <div className="settings-grid-2">{children}</div>;
}

const TABS = [
  { id: 'profil',        icon: User,        label: 'Mon Profil' },
  { id: 'email',         icon: Mail,        label: 'Comptes Email' },
  { id: 'api',           icon: Key,         label: 'IA & Clés API' },
  { id: 'devis',         icon: FileText,    label: 'Template Devis' },
  { id: 'crm',           icon: FileText,    label: 'Templates CRM' },
  { id: 'notifications', icon: Bell,        label: 'Notifications' },
  { id: 'autopilot',     icon: Bot,         label: 'Auto-Pilote' },
  { id: 'about',         icon: BarChart2,   label: 'Nouveautés' },
];

const ADMIN_TABS = [
  { id: 'prestashop',    icon: ShoppingBag, label: 'PrestaShop' },
  { id: 'marketing',     icon: TrendingUp,  label: 'Marketing IA' },
  { id: 'finance',       icon: BarChart2,   label: 'Finance IA' },
];

export default function SettingsModule({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('profil');
  const [settings, setSettings] = useState({
    // Profil
    nom: '', poste: '', signature_email: '', signature_is_html: 0, signature_photo: '',
    // Email
    imap_host: '', imap_port: 993, imap_user: '', imap_pass: '',
    smtp_host: '', smtp_port: 465, smtp_user: '', smtp_pass: '', smtp_accounts: '[]', smtp_default_sender: '',
    // IA
    ai_tone: 'professionnel', ai_langue: 'fr',
    // CRM Templates
    crm_template_promo: "Bonjour {prenom},\n\nNous avons une offre exceptionnelle pour vous ! Profitez de -15% sur votre prochaine commande avec le code PROMO15.\n\nCordialement,\n{signature}",
    crm_template_vip: "Bonjour {prenom},\n\nEn tant que client privilégié, nous vous invitons à découvrir en avant-première notre sélection exclusive VIP.\n\nCordialement,\n{signature}",
    crm_template_relance: "Bonjour {{client}},\n\nNous avons remarqué que vous avez laissé des superbes articles dans votre panier ({{montant}}€) :\n\n- {{produits}}\n\nSouhaitez-vous finaliser votre commande ?\n\nCordialement,\n{signature}",
    // PrestaShop (admin)
    ps_api_url: '', ps_api_key: '',
    // Auto-pilote
    autopilot_archive_noreply: 1, autopilot_archive_promo: 1, autopilot_delay_relance: 3,
    // Notifications
    notif_panier_abandon: 1, notif_stock_critique: 1, notif_email_sans_reponse: 1,
    // Finance IA
    finance_expense_coef: 1.15, finance_client_delay: 30, finance_supplier_delay: 30,
    // Marketing IA
    marketing_target_roas: 3.0, marketing_auto_pilot: 0, marketing_daily_budget: 50.0,
    marketing_google_ads_id: '', marketing_meta_ads_id: '', marketing_tiktok_ads_id: '',
    // Illustration signature
    signature_illustration: '',
    // Template Devis
    quote_company_name: '', quote_company_address: '', quote_company_city: '',
    quote_company_phone: '', quote_company_email: '', quote_company_siret: '',
    quote_company_logo: '', quote_payment_terms: 'Virement bancaire à 30 jours',
    quote_validity_days: 30, quote_footer_note: 'Merci de votre confiance.',
  });
  const [newCollab, setNewCollab] = useState({ nom: '', email: '', password: '', role: 'user' });
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null); // 'promo'|'vip'|'relance'|null
  const photoInputRef = useRef(null);
  const illustrationRef = useRef(null);

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (activeTab === 'team' && user?.role === 'admin') {
      fetchUsersList();
    }
  }, [activeTab]);

  const fetchUsersList = async () => {
    try {
      const res = await axios.get(`${API}/auth/users`);
      setUsersList(res.data);
    } catch (err) { console.error('Erreur chargement utilisateurs', err); }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      if (res.data) setSettings(prev => ({ ...prev, ...res.data }));
    } catch (err) { console.error('Erreur chargement paramètres', err); }
  };

  const handleSave = async () => {
    setIsLoading(true); setMessage(null);
    try {
      await axios.post(`${API}/settings`, settings);
      setMessage({ type: 'success', text: 'Paramètres sauvegardés avec succès.' });
    } catch (err) {
      const status = err.response?.status;
      const responseData = err.response?.data;
      const apiMessage = typeof responseData === 'string'
        ? responseData.slice(0, 500)
        : (responseData?.error || responseData?.message);
      const serverOffline = err.code === 'ERR_NETWORK' || !err.response;
      setMessage({
        type: 'error',
        text: serverOffline
          ? 'Serveur Mobywork indisponible. Lancez le serveur puis réessayez.'
          : apiMessage || `Erreur lors de la sauvegarde${status ? ` (${status})` : ''}.`
      });
    }
    setIsLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = (name, val) => setSettings(prev => ({ ...prev, [name]: val ? 1 : 0 }));

  const parseSmtpAccounts = (value = settings.smtp_accounts) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizeSenderId = (email, index = 0) => {
    const safe = String(email || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return safe || `sender-${Date.now()}-${index}`;
  };

  const setSmtpAccounts = (accounts, nextDefault = settings.smtp_default_sender) => {
    const clean = accounts.map((account, index) => ({
      ...account,
      id: account.id || normalizeSenderId(account.email || account.smtp_user, index),
    }));
    const defaultStillExists = clean.some(account => account.id === nextDefault);
    setSettings(prev => ({
      ...prev,
      smtp_accounts: JSON.stringify(clean),
      smtp_default_sender: defaultStillExists ? nextDefault : (clean[0]?.id || ''),
    }));
  };

  const addSmtpAccount = () => {
    const accounts = parseSmtpAccounts();
    setSmtpAccounts([
      ...accounts,
      {
        id: `sender-${Date.now()}`,
        label: '',
        email: '',
        smtp_user: '',
        smtp_pass: '',
        smtp_host: '',
        smtp_port: '',
      },
    ]);
  };

  const updateSmtpAccount = (index, field, value) => {
    const accounts = parseSmtpAccounts();
    const next = accounts.map((account, i) => (
      i === index
        ? {
            ...account,
            [field]: value,
            id: field === 'email' && (!account.id || account.id.startsWith('sender-'))
              ? normalizeSenderId(value, index)
              : account.id,
          }
        : account
    ));
    setSmtpAccounts(next);
  };

  const removeSmtpAccount = (index) => {
    const accounts = parseSmtpAccounts();
    setSmtpAccounts(accounts.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = (file) => {
    if (!file) return;
    if (!file.type.match(/image\/(jpeg|png|webp|gif)/)) {
      setMessage({ type: 'error', text: 'Format invalide. JPG, PNG, WEBP ou GIF acceptés.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image trop lourde (Max 2 Mo).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setSettings(prev => ({ ...prev, signature_photo: e.target.result }));
    reader.readAsDataURL(file);
  };

  const handleIllustrationUpload = (file) => {
    if (!file) return;
    if (!file.type.match(/image\/(jpeg|png|webp|gif|svg)/)) {
      setMessage({ type: 'error', text: 'Format invalide. JPG, PNG, WEBP, SVG ou GIF acceptés.' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image trop lourde (Max 3 Mo).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setSettings(prev => ({ ...prev, signature_illustration: e.target.result }));
    reader.readAsDataURL(file);
  };

  const buildTemplateHtml = (templateKey) => {
    const body = (settings[templateKey] || '').replace(/\n/g, '<br/>');
    const sigText = settings.signature_is_html
      ? (settings.signature_email || '')
      : (settings.signature_email || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    const illustration = settings.signature_illustration;
    return `
      <div style="font-family:sans-serif;color:#1e293b;line-height:1.7;max-width:580px;margin:0 auto;">
        <div style="padding:24px 28px;background:#f8fafc;border-radius:12px 12px 0 0;border-bottom:3px solid #3b82f6;">
          <p style="margin:0;font-size:15px;">${body}</p>
        </div>
        <div style="padding:16px 28px;background:#f1f5f9;border-radius:0 0 12px 12px;display:flex;align-items:center;gap:16px;">
          ${illustration ? `<img src="${illustration}" style="max-width:120px;max-height:60px;object-fit:contain;border-radius:6px;" />` : ''}
          <div style="font-size:13px;color:#475569;">${sigText || '<em>Signature non définie</em>'}</div>
        </div>
      </div>
    `;
  };

  const handleCreateCollab = async (e) => {
    e.preventDefault(); setIsLoading(true); setMessage(null);
    try {
      await axios.post(`${API}/auth/register`, newCollab);
      setMessage({ type: 'success', text: 'Collaborateur créé avec succès.' });
      setNewCollab({ nom: '', email: '', password: '', role: 'user' });
      fetchUsersList();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur lors de la création.' });
    }
    setIsLoading(false);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce compte ?")) return;
    try {
      await axios.delete(`${API}/auth/users/${id}`);
      setMessage({ type: 'success', text: 'Compte supprimé.' });
      fetchUsersList();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur lors de la suppression.' });
    }
  };

  const tabs = [...TABS, ...(user?.role === 'admin' ? ADMIN_TABS : [])];
  const needsSave = !['team'].includes(activeTab);
  const smtpAccounts = parseSmtpAccounts();
  const defaultSender = settings.smtp_default_sender || smtpAccounts[0]?.id || '';

  const renderSmtpAccountsSection = () => (
    <Section title="Adresses d'envoi">
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, marginTop: 0 }}>
        Ajoutez vos adresses Renovboat puis choisissez l'expediteur au moment d'envoyer un mail.
        Si le serveur, le port ou le mot de passe sont vides, Mobywork reutilise la configuration SMTP principale ci-dessus.
      </p>

      {smtpAccounts.length > 0 && (
        <Field label="Adresse par defaut">
          <select
            value={defaultSender}
            onChange={(e) => setSettings(prev => ({ ...prev, smtp_default_sender: e.target.value }))}
            style={inputStyle}
          >
            {smtpAccounts.map((account, index) => (
              <option key={account.id || index} value={account.id}>
                {(account.label || account.email || `Adresse ${index + 1}`)} {account.email ? `- ${account.email}` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {smtpAccounts.map((account, index) => (
          <div key={account.id || index} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', background: 'var(--bg-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.9rem' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                {account.email || `Adresse ${index + 1}`}
              </strong>
              <button
                type="button"
                onClick={() => removeSmtpAccount(index)}
                title="Supprimer cette adresse"
                style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: '8px', padding: '0.45rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
            <Grid2>
              <Field label="Libelle">
                <input value={account.label || ''} onChange={(e) => updateSmtpAccount(index, 'label', e.target.value)} placeholder="Contact Renovboat" style={inputStyle} />
              </Field>
              <Field label="Adresse email d'envoi">
                <input type="email" value={account.email || ''} onChange={(e) => updateSmtpAccount(index, 'email', e.target.value)} placeholder="contact@renovboat.com" style={inputStyle} />
              </Field>
              <Field label="Identifiant SMTP" hint="Laissez vide pour utiliser l'identifiant principal.">
                <input value={account.smtp_user || ''} onChange={(e) => updateSmtpAccount(index, 'smtp_user', e.target.value)} placeholder="contact@renovboat.com" style={inputStyle} />
              </Field>
              <Field label="Mot de passe SMTP" hint="Laissez vide pour utiliser le mot de passe principal.">
                <input type="password" value={account.smtp_pass || ''} onChange={(e) => updateSmtpAccount(index, 'smtp_pass', e.target.value)} placeholder="Mot de passe de cette boite" style={inputStyle} />
              </Field>
              <Field label="Serveur SMTP" hint="Optionnel si identique au principal.">
                <input value={account.smtp_host || ''} onChange={(e) => updateSmtpAccount(index, 'smtp_host', e.target.value)} placeholder="smtp.mail.ovh.net" style={inputStyle} />
              </Field>
              <Field label="Port">
                <input type="number" value={account.smtp_port || ''} onChange={(e) => updateSmtpAccount(index, 'smtp_port', e.target.value)} placeholder="465" style={inputStyle} />
              </Field>
            </Grid2>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={defaultSender === account.id}
                onChange={() => setSettings(prev => ({ ...prev, smtp_default_sender: account.id }))}
              />
              Utiliser par defaut
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSmtpAccount}
        style={{ marginTop: '1rem', padding: '0.65rem 1rem', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <Plus size={15} /> Ajouter une adresse
      </button>
    </Section>
  );

  return (
    <div className="module-scroll" style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', width: '100%' }}>

      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Paramètres</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Configurations personnelles de <strong style={{ color: 'var(--text-secondary)' }}>{user?.email}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {user?.role === 'admin' && (
            <button onClick={() => { window.location.href = '/OceanOS/'; }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
              <Users size={15} /> Droits OceanOS
            </button>
          )}
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </header>

      {/* MESSAGE */}
      {message && (
        <div style={{ padding: '0.875rem 1rem', marginBottom: '1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: message.type === 'success' ? '#22c55e' : '#ef4444', border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="settings-layout-wrapper">

        {/* SIDEBAR TABS */}
        <nav className="settings-tabs-sidebar" style={{ width: '200px', flexShrink: 0, background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMessage(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: isActive ? 700 : 500, fontSize: '0.84rem', background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', color: isActive ? 'var(--accent-blue, #3b82f6)' : 'var(--text-secondary)', width: '100%', textAlign: 'left', transition: 'all 0.15s' }}>
                <Icon size={15} style={{ flexShrink: 0 }} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* CONTENT PANEL */}
        <div className="settings-content-panel" style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '2rem', minWidth: 0 }}>

          {/* ── PROFIL ── */}
          {activeTab === 'profil' && (
            <div>
              <Section title="👤 Informations personnelles">
                <Grid2>
                  <Field label="Nom complet">
                    <input name="nom" value={settings.nom || ''} onChange={handleChange} placeholder="Paul Picard" style={inputStyle} />
                  </Field>
                  <Field label="Poste / Fonction">
                    <input name="poste" value={settings.poste || ''} onChange={handleChange} placeholder="Responsable commercial" style={inputStyle} />
                  </Field>
                </Grid2>
              </Section>
              <Section title="✍️ Signature email">
                <Field label="Signature automatique" hint="Utilisez {prenom} dans vos templates CRM pour l'insérer automatiquement.">
                  <textarea
                    name="signature_email"
                    value={settings.signature_email || ''}
                    onChange={handleChange}
                    placeholder={settings.signature_is_html
                      ? '<table><tr><td><img src="https://..." width="96"></td><td><strong>Paul Picard</strong><br>RenovBoat</td></tr></table>'
                      : "Cordialement,\nPaul Picard\nRenovBoat - +33 6 XX XX XX XX"}
                    rows={settings.signature_is_html ? 10 : 5}
                    spellCheck={!settings.signature_is_html}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: settings.signature_is_html ? 'monospace' : 'inherit' }}
                  />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-elevated)', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Signature au format HTML</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                      Activez ce mode pour coller une signature HTML avec images, liens et mise en forme.
                    </div>
                  </div>
                  <Toggle checked={!!settings.signature_is_html} onChange={(val) => handleToggle('signature_is_html', val)} />
                </div>
                {settings.signature_email && (
                  <Field label="Aperçu de la signature">
                    <iframe
                      title="preview-signature-email"
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;background:#fff;font-family:Arial,sans-serif;color:#1e293b;}</style></head><body>${settings.signature_is_html ? settings.signature_email : (settings.signature_email || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</body></html>`}
                      style={{ width: '100%', minHeight: settings.signature_is_html ? '180px' : '120px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff' }}
                      sandbox="allow-same-origin"
                    />
                  </Field>
                )}
                <Field label="Photo / Logo de signature" hint="Cette image sera jointe visuellement dans vos signatures d'email. Formats : JPG, PNG, WEBP. Max 2 Mo.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.25rem' }}>
                    {/* Preview */}
                    <div
                      onClick={() => photoInputRef.current?.click()}
                      style={{
                        width: '90px', height: '90px', borderRadius: '12px', flexShrink: 0,
                        border: `2px dashed ${settings.signature_photo ? 'var(--accent-blue, #3b82f6)' : 'var(--border-hover)'}`,
                        background: settings.signature_photo ? 'transparent' : 'var(--bg-elevated)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', overflow: 'hidden', position: 'relative',
                        transition: 'all 0.2s',
                      }}
                    >
                      {settings.signature_photo ? (
                        <img src={settings.signature_photo} alt="Photo de signature" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '2rem' }}>🖼️</span>
                      )}
                    </div>
                    {/* Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        style={{ padding: '0.5rem 1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        📂 {settings.signature_photo ? 'Changer la photo' : 'Choisir une photo'}
                      </button>
                      {settings.signature_photo && (
                        <button
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, signature_photo: '' }))}
                          style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                        >
                          🗑️ Supprimer
                        </button>
                      )}
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Idéalement 200×200px ou votre logo d'entreprise.</p>
                    </div>
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]); }}
                  />
                </Field>
              </Section>
            </div>
          )}

          {/* ── EMAIL ── */}
          {activeTab === 'email' && (
            <div>
              <Section title="📥 Réception IMAP">
                <Grid2>
                  <Field label="Serveur hôte"><input name="imap_host" value={settings.imap_host || ''} onChange={handleChange} placeholder="imap.mail.ovh.net" style={inputStyle} /></Field>
                  <Field label="Port"><input name="imap_port" type="number" value={settings.imap_port || ''} onChange={handleChange} style={inputStyle} /></Field>
                  <Field label="Identifiant (email)"><input name="imap_user" value={settings.imap_user || ''} onChange={handleChange} placeholder="contact@domaine.com" style={inputStyle} /></Field>
                  <Field label="Mot de passe"><input name="imap_pass" type="password" value={settings.imap_pass || ''} onChange={handleChange} placeholder="••••••••" style={inputStyle} /></Field>
                </Grid2>
              </Section>
              <Section title="📤 Envoi SMTP">
                <Grid2>
                  <Field label="Serveur hôte"><input name="smtp_host" value={settings.smtp_host || ''} onChange={handleChange} placeholder="smtp.mail.ovh.net" style={inputStyle} /></Field>
                  <Field label="Port"><input name="smtp_port" type="number" value={settings.smtp_port || ''} onChange={handleChange} style={inputStyle} /></Field>
                  <Field label="Identifiant (email)"><input name="smtp_user" value={settings.smtp_user || ''} onChange={handleChange} placeholder="contact@domaine.com" style={inputStyle} /></Field>
                  <Field label="Mot de passe"><input name="smtp_pass" type="password" value={settings.smtp_pass || ''} onChange={handleChange} placeholder="••••••••" style={inputStyle} /></Field>
                </Grid2>
              </Section>
              {renderSmtpAccountsSection()}
            </div>
          )}

          {/* ── IA & API ── */}
          {activeTab === 'api' && (
            <div>
              <Section title="🔑 Clé API Groq">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                  La clé Groq est maintenant partagée par toutes les apps et se configure dans le menu utilisateur OceanOS.
                </p>
                <button type="button" onClick={() => { window.location.href = '/OceanOS/#ia'; }} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontWeight: 700, cursor: 'pointer' }}>
                  Ouvrir la configuration IA OceanOS
                </button>
              </Section>
              <Section title="🧠 Comportement de l'IA">
                <Grid2>
                  <Field label="Langue des réponses IA">
                    <select name="ai_langue" value={settings.ai_langue || 'fr'} onChange={handleChange} style={inputStyle}>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="es">🇪🇸 Español</option>
                      <option value="de">🇩🇪 Deutsch</option>
                    </select>
                  </Field>
                  <Field label="Ton par défaut des réponses">
                    <select name="ai_tone" value={settings.ai_tone || 'professionnel'} onChange={handleChange} style={inputStyle}>
                      <option value="professionnel">🎩 Professionnel & courtois</option>
                      <option value="amical">😊 Amical & chaleureux</option>
                      <option value="direct">⚡ Direct & concis</option>
                      <option value="luxe">💎 Premium & soigné</option>
                    </select>
                  </Field>
                </Grid2>
              </Section>

              <Section title="📢 Clés API Publicitaires">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  Identifiants requis pour synchroniser vos dépenses publicitaires réelles avec le Dashboard Marketing.
                </p>
                <Grid2>
                  <Field label="Google Ads Customer ID" hint="Format: XXX-XXX-XXXX">
                    <input name="marketing_google_ads_id" value={settings.marketing_google_ads_id || ''} onChange={handleChange} placeholder="123-456-7890" style={inputStyle} />
                  </Field>
                  <Field label="Meta Business ID (Facebook/IG)" hint="ID de votre compte publicitaire Meta.">
                    <input name="marketing_meta_ads_id" value={settings.marketing_meta_ads_id || ''} onChange={handleChange} placeholder="act_XXXXXXXXXXXXXXX" style={inputStyle} />
                  </Field>
                </Grid2>
                <Field label="TikTok Ads ID (Optionnel)">
                  <input name="marketing_tiktok_ads_id" value={settings.marketing_tiktok_ads_id || ''} onChange={handleChange} placeholder="71234567890..." style={inputStyle} />
                </Field>
              </Section>
            </div>
          )}

          {/* ── TEMPLATE DEVIS ── */}
          {activeTab === 'devis' && (() => {
            const DEFAULT_TEMPLATE = `<div style="font-family: Arial, sans-serif; max-width: 780px; margin: 0 auto; color: #1e2a3a;">

  <!-- EN-TÊTE ENTREPRISE -->
  <div style="background: #14213a; color: white; padding: 24px 30px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <h1 style="margin: 0; font-size: 22px;">{company_name}</h1>
      <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.7;">{company_address}, {company_city}</p>
      <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.7;">{company_phone} · {company_email}</p>
      <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.5;">SIRET : {company_siret}</p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">DEVIS</div>
      <div style="font-size: 13px; opacity: 0.8;">N° {reference}</div>
    </div>
  </div>

  <!-- INFOS DEVIS & CLIENT -->
  <div style="display: flex; gap: 20px; padding: 20px 30px; background: #f8fafc;">
    <div style="flex: 1;">
      <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Informations</p>
      <p style="margin: 6px 0 2px; font-size: 13px;">📅 Émis le : <strong>{date}</strong></p>
      <p style="margin: 0 0 2px; font-size: 13px;">⏳ Valable jusqu'au : <strong>{date_expiration}</strong></p>
      <p style="margin: 0; font-size: 13px;">👤 Établi par : <strong>{vendor}</strong></p>
    </div>
    <div style="flex: 1; background: white; border-radius: 8px; padding: 14px 18px; border: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Destinataire</p>
      <p style="margin: 8px 0 4px; font-size: 15px; font-weight: bold;">{client_nom}</p>
      <p style="margin: 0; font-size: 13px; color: #3b82f6;">{client_email}</p>
    </div>
  </div>

  <!-- TABLEAU DES ARTICLES -->
  {lines_table}

  <!-- TOTAUX -->
  <div style="display: flex; justify-content: flex-end; padding: 12px 30px 20px;">
    <div style="width: 260px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; color: #64748b;">
        <span>Total HT</span><span>{total_ht} €</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
        <span>TVA</span><span>{total_tva} €</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 12px 16px; font-size: 16px; font-weight: bold; background: #eff6ff; color: #1d4ed8; border-top: 2px solid #3b82f6;">
        <span>Total TTC</span><span>{total_ttc} €</span>
      </div>
    </div>
  </div>

  <!-- CONDITIONS & PIED DE PAGE -->
  <div style="padding: 0 30px 20px;">
    <p style="font-size: 12px; color: #64748b;"><strong>Conditions de règlement :</strong> {payment_terms}</p>
    <div style="background: #14213a; color: #94a3b8; padding: 14px 20px; border-radius: 6px; font-size: 11px; text-align: center;">
      {footer_note}
    </div>
  </div>

</div>`;

            const templateValue = getQuoteTemplate(settings.quote_html_template || INVOCEAN_QUOTE_TEMPLATE);
            const previewHtml = buildQuotePreviewHtml({ ...settings, quote_html_template: templateValue })
              .replace(/{company_name}/g, settings.quote_company_name || 'Mon Entreprise')
              .replace(/{company_address}/g, settings.quote_company_address || '12 Rue du Port')
              .replace(/{company_city}/g, settings.quote_company_city || '13600 La Ciotat')
              .replace(/{company_phone}/g, settings.quote_company_phone || '+33 6 00 00 00 00')
              .replace(/{company_email}/g, settings.quote_company_email || 'contact@entreprise.fr')
              .replace(/{company_siret}/g, settings.quote_company_siret || '123 456 789 00010')
              .replace(/{reference}/g, 'DEV-2026-0001')
              .replace(/{date}/g, new Date().toLocaleDateString('fr-FR'))
              .replace(/{date_expiration}/g, new Date(Date.now() + (settings.quote_validity_days || 30) * 86400000).toLocaleDateString('fr-FR'))
              .replace(/{vendor}/g, settings.nom || 'Paul Picard')
              .replace(/{client_nom}/g, 'Marine Équipement')
              .replace(/{client_email}/g, 'contact@marine-equip.fr')
              .replace(/{total_ht}/g, '153.60')
              .replace(/{total_tva}/g, '30.72')
              .replace(/{total_ttc}/g, '184.32')
              .replace(/{payment_terms}/g, settings.quote_payment_terms || 'Virement bancaire à 30 jours')
              .replace(/{footer_note}/g, settings.quote_footer_note || 'Merci de votre confiance.')
              .replace(/{lines_table}/g, `<table style="width:100%;border-collapse:collapse;margin:0 30px;width:calc(100% - 60px)"><thead><tr style="background:#3b82f6;color:white"><th style="padding:10px 12px;text-align:left;font-size:12px">Description</th><th style="padding:10px;font-size:12px">Qté</th><th style="padding:10px;font-size:12px">Prix HT</th><th style="padding:10px;font-size:12px">TVA</th><th style="padding:10px;text-align:right;font-size:12px">Total TTC</th></tr></thead><tbody><tr style="background:#f8fafc"><td style="padding:10px 12px;font-size:13px">Bande de ragage L Blanc &amp; Bleu</td><td style="padding:10px;text-align:center;font-size:13px">16</td><td style="padding:10px;text-align:right;font-size:13px">9.60 €</td><td style="padding:10px;text-align:center;font-size:13px">20%</td><td style="padding:10px;text-align:right;font-size:13px;font-weight:bold">184.32 €</td></tr></tbody></table>`);

            const VARS = [
              ['{company_name}','Nom entreprise'],['{company_address}','Adresse'],['{company_city}','Ville & CP'],
              ['{company_phone}','Téléphone'],['{company_email}','Email entreprise'],['{company_siret}','SIRET'],
              ['{reference}','N° Devis'],['{date}','Date émission'],['{date_expiration}','Date expiration'],
              ['{vendor}','Votre nom'],['{client_nom}','Nom client'],['{client_email}','Email client'],
              ['{total_ht}','Total HT'],['{total_tva}','Total TVA'],['{total_ttc}','Total TTC'],
              ['{payment_terms}','Conditions paiement'],['{footer_note}','Pied de page'],
              ['{lines_table}','🧾 Tableau des produits (OBLIGATOIRE)'],
            ];

            const insertVar = (v) => {
              setSettings(prev => ({ ...prev, quote_html_template: (getQuoteTemplate(prev.quote_html_template || INVOCEAN_QUOTE_TEMPLATE)) + v }));
            };

            return (
              <div>
                <Section title="🏢 Coordonnées entreprise (injectées dans le template)">
                  <Grid2>
                    <Field label="Nom de l'entreprise"><input name="quote_company_name" value={settings.quote_company_name || ''} onChange={handleChange} placeholder="RenovBoat SAS" style={inputStyle} /></Field>
                    <Field label="Téléphone"><input name="quote_company_phone" value={settings.quote_company_phone || ''} onChange={handleChange} placeholder="+33 6 XX XX XX XX" style={inputStyle} /></Field>
                  </Grid2>
                  <Grid2>
                    <Field label="Adresse (rue)"><input name="quote_company_address" value={settings.quote_company_address || ''} onChange={handleChange} placeholder="12 Rue du Port" style={inputStyle} /></Field>
                    <Field label="Ville & Code postal"><input name="quote_company_city" value={settings.quote_company_city || ''} onChange={handleChange} placeholder="13600 La Ciotat" style={inputStyle} /></Field>
                  </Grid2>
                  <Grid2>
                    <Field label="Email entreprise"><input name="quote_company_email" value={settings.quote_company_email || ''} onChange={handleChange} placeholder="contact@renovboat.fr" style={inputStyle} /></Field>
                    <Field label="SIRET"><input name="quote_company_siret" value={settings.quote_company_siret || ''} onChange={handleChange} placeholder="123 456 789 00010" style={inputStyle} /></Field>
                  </Grid2>
                  <Grid2>
                    <Field label="Conditions de paiement"><input name="quote_payment_terms" value={settings.quote_payment_terms || ''} onChange={handleChange} placeholder="Virement bancaire à 30 jours" style={inputStyle} /></Field>
                    <Field label="Validité (jours)"><input name="quote_validity_days" type="number" value={settings.quote_validity_days || 30} onChange={handleChange} min="1" max="365" style={inputStyle} /></Field>
                  </Grid2>
                  <Field label="Note de pied de page"><input name="quote_footer_note" value={settings.quote_footer_note || ''} onChange={handleChange} placeholder="Merci de votre confiance." style={inputStyle} /></Field>
                </Section>

                <Section title="📝 Template HTML du devis">
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Rédigez librement votre mise en page en HTML. Utilisez les variables ci-dessous qui seront remplacées par les données réelles lors de la génération PDF. Un template par défaut professionnel est pré-rempli.
                  </p>

                  {/* VARIABLES CHIPS */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>👆 Cliquez pour copier une variable :</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {VARS.map(([v, label]) => (
                        <button key={v} type="button" onClick={() => { navigator.clipboard.writeText(v); }}
                          style={{ padding: '3px 8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '5px', cursor: 'pointer', fontSize: '0.72rem', color: '#3b82f6', fontFamily: 'monospace', whiteSpace: 'nowrap' }}
                          title={`Copier ${v}`}
                        >
                          {v} <span style={{ opacity: 0.6, fontFamily: 'sans-serif' }}>— {label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* EDITOR */}
                  <textarea
                    name="quote_html_template"
                    value={templateValue}
                    onChange={e => setSettings(prev => ({ ...prev, quote_html_template: e.target.value }))}
                    rows={20}
                    spellCheck={false}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: 'monospace', fontSize: '0.78rem' }}
                  />
                  <button type="button"
                    onClick={() => setSettings(prev => ({ ...prev, quote_html_template: INVOCEAN_QUOTE_TEMPLATE }))}
                    style={{ marginTop: '0.5rem', padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    ↩ Restaurer le template par défaut
                  </button>
                </Section>

                <Section title="👁 Prévisualisation en temps réel">
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Rendu avec des données fictives. Les vraies données seront injectées lors de la génération PDF.
                  </p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
                    <div style={{ background: 'var(--bg-elevated)', padding: '6px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                      📄 Aperçu du rendu PDF
                    </div>
                    <iframe
                      title="preview-devis"
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:12px;background:white}</style></head><body>${previewHtml}</body></html>`}
                      style={{ width: '100%', height: '600px', border: 'none' }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                </Section>
              </div>
            );
          })()}



          {/* ── CRM TEMPLATES ── */}
          {activeTab === 'crm' && (
            <div>
              {/* Illustration de signature */}
              <Section title="🖼️ Illustration de signature d'entreprise">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: '1rem' }}>
                  Cette image (logo, bannière, visuel de marque) sera insérée en bas de chaque email envoyé depuis les templates CRM.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  {/* Preview zone */}
                  <div
                    onClick={() => illustrationRef.current?.click()}
                    style={{
                      width: '200px', height: '80px', borderRadius: '10px', flexShrink: 0,
                      border: `2px dashed ${settings.signature_illustration ? '#3b82f6' : 'var(--border-hover)'}`,
                      background: settings.signature_illustration ? '#0f172a' : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {settings.signature_illustration ? (
                      <img src={settings.signature_illustration} alt="Illustration" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Image size={24} />
                        <p style={{ fontSize: '0.75rem', margin: '4px 0 0' }}>Cliquer pour uploader</p>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button type="button" onClick={() => illustrationRef.current?.click()}
                      style={{ padding: '0.5rem 1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                      📂 {settings.signature_illustration ? 'Changer l\'illustration' : 'Choisir une illustration'}
                    </button>
                    {settings.signature_illustration && (
                      <button type="button" onClick={() => setSettings(prev => ({ ...prev, signature_illustration: '' }))}
                        style={{ padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                        🗑️ Supprimer
                      </button>
                    )}
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Logo, bannière, signature visuelle. Max 3 Mo. PNG/JPG/SVG recommandé.</p>
                  </div>
                </div>
                <input ref={illustrationRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" style={{ display: 'none' }}
                  onChange={(e) => { if (e.target.files?.[0]) handleIllustrationUpload(e.target.files[0]); }}
                />
              </Section>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Variables disponibles : <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{'{prenom}'}</code> <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{'{nom}'}</code> <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{'{signature}'}</code>
                <br/><br/>
                Variables (Relance Panier) : <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{'{{client}}'}</code> <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{'{{montant}}'}</code> <code style={{ background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>{'{{produits}}'}</code>
              </p>

              {[{key:'crm_template_promo',title:'🏷️ Template Offre Promotionnelle',hint:"Envoyé avec le bouton « Créer une Promo » dans le CRM."},
                {key:'crm_template_vip',title:'⭐ Template Invitation VIP',hint:"Envoyé avec le bouton « Proposer une offre VIP » dans le CRM."},
                {key:'crm_template_relance',title:'🔔 Template Email de Relance',hint:"Envoyé avec le bouton de relance depuis le tableau de bord ou le CRM."},
              ].map(tpl => (
                <Section key={tpl.key} title={tpl.title}>
                  <Field label="Contenu du message" hint={tpl.hint}>
                    <textarea name={tpl.key} value={settings[tpl.key] || ''} onChange={handleChange} rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(previewTemplate === tpl.key ? null : tpl.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: previewTemplate === tpl.key ? '#3b82f6' : 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: previewTemplate === tpl.key ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}
                  >
                    <Eye size={14} /> {previewTemplate === tpl.key ? 'Masquer la prévisualisation' : 'Voir le rendu email'}
                  </button>
                  {previewTemplate === tpl.key && (
                    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                      <div style={{ background: '#0f172a', padding: '8px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>📧 Aperçu du rendu dans la boîte de réception</div>
                      <iframe
                        title={`preview-${tpl.key}`}
                        srcDoc={buildTemplateHtml(tpl.key)}
                        style={{ width: '100%', minHeight: '220px', border: 'none', background: '#fff' }}
                        sandbox="allow-same-origin"
                      />
                    </div>
                  )}
                </Section>
              ))}
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div>
              <Section title="🔔 Alertes dans le Dashboard">
                {[
                  { key: 'notif_panier_abandon', label: 'Paniers abandonnés', desc: 'Alerte lorsqu\'un client laisse un panier sans finaliser sa commande.' },
                  { key: 'notif_stock_critique', label: 'Stock critique', desc: 'Alerte lorsqu\'un produit passe sous le seuil minimum de stock.' },
                  { key: 'notif_email_sans_reponse', label: 'Emails sans réponse', desc: 'Alerte lorsque des emails professionnels restent sans réponse depuis 24h.' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{item.desc}</div>
                    </div>
                    <Toggle checked={!!settings[item.key]} onChange={(val) => handleToggle(item.key, val)} />
                  </div>
                ))}
              </Section>
            </div>
          )}

          {/* ── AUTO-PILOTE ── */}
          {activeTab === 'autopilot' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Configurez le comportement de l'Auto-Pilote IA qui traite automatiquement votre boîte mail.
              </p>
              <Section title="🤖 Archivage automatique">
                {[
                  { key: 'autopilot_archive_noreply', label: 'Archiver les "noreply"', desc: 'Archiver automatiquement les emails provenant d\'adresses noreply@...' },
                  { key: 'autopilot_archive_promo', label: 'Archiver les newsletters/promos', desc: 'Archiver les emails catégorisés comme newsletters ou promotions.' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{item.desc}</div>
                    </div>
                    <Toggle checked={!!settings[item.key]} onChange={(val) => handleToggle(item.key, val)} />
                  </div>
                ))}
              </Section>
              <Section title="⏰ Délais">
                <Field label="Délai de relance automatique (jours)" hint="Nombre de jours sans réponse d'un client avant de déclencher une suggestion de relance.">
                  <input name="autopilot_delay_relance" type="number" min={1} max={30} value={settings.autopilot_delay_relance || 3} onChange={handleChange} style={{ ...inputStyle, width: '120px' }} />
                </Field>
              </Section>
            </div>
          )}

          {/* ── PRESTASHOP (ADMIN) ── */}
          {activeTab === 'prestashop' && user?.role === 'admin' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Configuration de la connexion à votre boutique PrestaShop. Ces paramètres s'appliquent à tous les collaborateurs.
              </p>
              <Section title="🛒 Connexion PrestaShop">
                <Field label="URL de l'API PrestaShop" hint="Format : https://votresite.com/api/">
                  <input name="ps_api_url" value={settings.ps_api_url || ''} onChange={handleChange} placeholder="https://renovboat.com/api/" style={inputStyle} />
                </Field>
                <Field label="Clé API PrestaShop" hint="Générée dans PrestaShop > Paramètres avancés > Webservice.">
                  <input name="ps_api_key" type="password" value={settings.ps_api_key || ''} onChange={handleChange} placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" style={{ ...inputStyle, fontFamily: 'monospace' }} />
                </Field>
              </Section>
            </div>
          )}

          {/* ── FINANCE (ADMIN) ── */}
          {activeTab === 'finance' && user?.role === 'admin' && (
            <div className="tab-pane active" style={{ animation: 'fadeIn 0.3s' }}>
              <Section title="Paramètres Finance IA">
                <Grid2>
                  <Field label="Coefficient de Charges (ex: 1.15 = 15%)" hint="Permet à l'IA d'estimer les charges non visibles ou l'impact des taxes.">
                    <input style={inputStyle} type="number" step="0.01" value={settings.finance_expense_coef} onChange={e => handleChange({ target: { name: 'finance_expense_coef', value: e.target.value }})} />
                  </Field>
                  <Field label="Délai Paiement Clients (jours)" hint="Moyenne pour le cashflow.">
                    <input style={inputStyle} type="number" value={settings.finance_client_delay} onChange={e => handleChange({ target: { name: 'finance_client_delay', value: e.target.value }})} />
                  </Field>
                  <Field label="Délai Paiement Fournisseurs (jours)" hint="Moyenne pour la provision.">
                    <input style={inputStyle} type="number" value={settings.finance_supplier_delay} onChange={e => handleChange({ target: { name: 'finance_supplier_delay', value: e.target.value }})} />
                  </Field>
                </Grid2>
              </Section>
            </div>
          )}


          {/* ── MARKETING IA (ADMIN) ── */}
          {activeTab === 'marketing' && user?.role === 'admin' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Configurez les objectifs et les comportements de l'IA pour vos campagnes publicitaires et sociales.
              </p>
              <Section title="🎯 Objectifs Marketing">
                <Grid2>
                  <Field label="Objectif de ROAS Cible (x)" hint="Utilisé par l'IA pour juger de la rentabilité de vos campagnes (ex: 3.0 = 3€ de CA pour 1€ dépensé).">
                    <input name="marketing_target_roas" type="number" step="0.1" value={settings.marketing_target_roas || 3.0} onChange={handleChange} style={inputStyle} />
                  </Field>
                  <Field label="Budget Quotidien Global (€)" hint="Plafond de dépense quotidien que l'IA ne doit pas dépasser pour l'ensemble des canaux.">
                    <input name="marketing_daily_budget" type="number" value={settings.marketing_daily_budget || 50} onChange={handleChange} style={inputStyle} />
                  </Field>
                </Grid2>
              </Section>
              <Section title="🤖 Automatisation IA">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Mode Auto-Pilote Marketing</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Permettre à l'IA d'ajuster automatiquement les budgets des campagnes en fonction de leur score de performance.
                    </div>
                  </div>
                  <Toggle checked={!!settings.marketing_auto_pilot} onChange={(val) => handleToggle('marketing_auto_pilot', val)} />
                </div>
              </Section>
            </div>
          )}

          {/* ── ÉQUIPE (ADMIN) ── */}
          {activeTab === 'team' && user?.role === 'admin' && (
            <div>
              <Section title="➕ Créer un collaborateur">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Seuls les administrateurs peuvent créer de nouveaux comptes. Le collaborateur devra configurer ses propres accès email dans ses Paramètres.
                </p>
                <form onSubmit={handleCreateCollab}>
                  <Grid2>
                    <Field label="Nom complet"><input value={newCollab.nom} onChange={e => setNewCollab({ ...newCollab, nom: e.target.value })} placeholder="Jean Dupont" style={inputStyle} required /></Field>
                    <Field label="Email (identifiant de connexion)"><input type="email" value={newCollab.email} onChange={e => setNewCollab({ ...newCollab, email: e.target.value })} placeholder="jean@entreprise.com" style={inputStyle} required /></Field>
                    <Field label="Mot de passe provisoire"><input type="password" value={newCollab.password} onChange={e => setNewCollab({ ...newCollab, password: e.target.value })} placeholder="••••••••" style={inputStyle} required minLength={6} /></Field>
                    <Field label="Rôle">
                      <select value={newCollab.role} onChange={e => setNewCollab({ ...newCollab, role: e.target.value })} style={inputStyle}>
                        <option value="user">👤 Collaborateur</option>
                        <option value="admin">🔑 Administrateur</option>
                      </select>
                    </Field>
                  </Grid2>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="submit" disabled={isLoading} style={{ padding: '0.75rem 1.5rem', background: '#22c55e', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <UserPlus size={16} /> {isLoading ? 'Création...' : 'Créer le compte'}
                    </button>
                  </div>
                </form>
              </Section>

              <Section title="👥 Comptes de l'équipe">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  {usersList.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement des comptes...</div>
                  ) : (
                    usersList.map((u) => (
                      <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: u.role === 'admin' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: u.role === 'admin' ? '#8b5cf6' : '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                            {u.nom ? u.nom.substring(0, 2).toUpperCase() : u.email.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {u.nom} {u.id === user?.id && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(Vous)</span>}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: u.role === 'admin' ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)', color: u.role === 'admin' ? '#8b5cf6' : '#3b82f6', border: `1px solid ${u.role === 'admin' ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}` }}>
                            {u.role === 'admin' ? 'Admin' : 'Collaborateur'}
                          </span>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              <Trash2 size={14} /> Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* ── À PROPOS & NOUVEAUTÉS ── */}
          {activeTab === 'about' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.05))', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>⚓</div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>MobyWorkspace</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Version 1.1.0 — IA BETA — Build {new Date().toLocaleDateString('fr-FR')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: '0.2rem' }}>Cockpit IA tout-en-un pour eCommerce</div>
                </div>
              </div>

              <Section title="🚀 Nouveautés v1.1 — Avril 2026">
                {[
                  { icon: '⚡', label: 'Command Palette (Ctrl+K)', desc: 'Navigation ultra-rapide vers tous les modules. Appuyez sur Ctrl+K n\'importe où.' },
                  { icon: '🔔', label: 'Notifications Toast', desc: 'Alertes visuelles non-bloquantes en temps réel (success, erreur, avertissement).' },
                  { icon: '🤖', label: 'Module Automatisation IA', desc: 'Vrai tableau de bord des règles automatiques avec statistiques et activité récente.' },
                  { icon: '🔑', label: 'Page Login refondue', desc: 'Design split-layout premium avec animations fluides et bouton eye pour mot de passe.' },
                  { icon: '🛡️', label: 'Error Boundary global', desc: 'Les erreurs sont maintenant capturées et présentent une interface de récupération.' },
                  { icon: '🗃️', label: 'Déduplication CRM', desc: 'Les doublons de clients via PrestaShop (même email) sont automatiquement filtrés.' },
                  { icon: '💎', label: 'CORS sécurisé production', desc: 'Configuration stricte pour déploiement en ligne (FRONTEND_URL configurable).' },
                  { icon: '📦', label: 'Build Vite optimisé', desc: 'Code splitting (vendor/charts/icons) — chargements plus rapides en production.' },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="⌨️ Raccourcis clavier">
                {[
                  { keys: ['Ctrl/⌘', '⇧ Shift', 'K'], label: 'Ouvrir la palette de commandes' },
                  { keys: ['T'], label: 'Email : Marquer comme traité' },
                  { keys: ['A'], label: 'Email : Archiver' },
                  { keys: ['↑ / ↓'], label: 'Command Palette : Naviguer dans les résultats' },
                  { keys: ['Entrée'], label: 'Command Palette : Exécuter la commande' },
                  { keys: ['Echap'], label: 'Fermer les panneaux et modales' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: 8, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {s.keys.map((k, j) => (
                        <kbd key={j} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </Section>
            </div>
          )}

          {/* ── SAVE BUTTON ── */}
          {needsSave && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSave} disabled={isLoading} style={{ padding: '0.8rem 1.75rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', opacity: isLoading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(59,130,246,0.3)', transition: 'all 0.2s' }}>
                <Save size={16} /> {isLoading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
