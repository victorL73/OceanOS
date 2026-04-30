import React from 'react';
import axios from 'axios';
import { Archive, Check, Inbox, Star, AlertTriangle, FileText, RefreshCw, Zap, TrendingUp, Users, PenTool, Send } from 'lucide-react';

export default function Sidebar({ stats, mailboxes = [], selectedMailbox = 'all', onMailboxChange, onFilterChange, activeFilter, onSync, isSyncing = false, onCompose }) {
    
    const [isAutoPilotGearing, setIsAutoPilotGearing] = React.useState(false);
    const selectedBox = mailboxes.find(box => box.id === selectedMailbox);
    const sentCount = selectedMailbox === 'all'
        ? mailboxes.reduce((sum, box) => sum + Number(box.sentCount || 0), 0)
        : Number(selectedBox?.sentCount || 0);

    const doAutoPilot = async () => {
        if(isAutoPilotGearing || isSyncing) return;
        setIsAutoPilotGearing(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/autopilot`);
            alert(res.data.message);
            await onSync?.(); // rafraichit les listes
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'Auto-pilote");
        }
        setIsAutoPilotGearing(false);
    };

    return (
        <aside className="sidebar">
            <button 
                className="crm-btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem', padding: '0.6rem', gap: '0.5rem', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, display: 'flex', alignItems: 'center' }} 
                onClick={onCompose}
            >
                <PenTool size={16} />
                Nouveau message
            </button>

            {/* STATS RAPIDES */}
            <div className="sidebar-stats">
              <div className="stat-mini">
                <span className="stat-mini-value" style={{ color: 'var(--accent-blue)' }}>{stats.a_traiter || 0}</span>
                <span className="stat-mini-label">À traiter</span>
              </div>
              <div className="stat-mini">
                <span className="stat-mini-value" style={{ color: 'var(--accent-red)' }}>{stats.urgents || 0}</span>
                <span className="stat-mini-label">Urgents</span>
              </div>
            </div>

            <span className="sidebar-section-label">Navigation</span>

            <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Boite affichee
                </label>
                <select
                    value={selectedMailbox}
                    onChange={(e) => onMailboxChange?.(e.target.value)}
                    style={{
                        width: '100%',
                        minHeight: 38,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        padding: '0 0.65rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                    }}
                >
                    <option value="all">Toutes les boites</option>
                    {mailboxes.map((box) => (
                        <option key={box.id} value={box.id}>
                            {box.label || box.email} {box.email ? `- ${box.email}` : ''}
                        </option>
                    ))}
                </select>
            </div>

            <div 
                className={`sidebar-item ${activeFilter === 'inbox' ? 'active' : ''}`} 
                onClick={() => onFilterChange('inbox')}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="item-icon"><Inbox size={16} /></span>
                    Boîte de réception
                </div>
                {stats.a_traiter > 0 && <span className="item-count blue">{stats.a_traiter}</span>}
            </div>

            <div 
                className={`sidebar-item ${activeFilter === 'sent' ? 'active' : ''}`} 
                onClick={() => onFilterChange('sent')}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="item-icon"><Send size={16} /></span>
                    Envoyes
                </div>
                {sentCount > 0 && <span className="item-count blue">{sentCount}</span>}
            </div>

            <div 
                className={`sidebar-item ${activeFilter === 'urgent' ? 'active' : ''}`}
                onClick={() => onFilterChange('urgent')}
            >
                <span className="item-icon" style={{ color: 'var(--accent-red)' }}><AlertTriangle size={16} /></span>
                Urgent
            </div>

            <span className="sidebar-section-label" style={{ marginTop: '1.25rem' }}>Business & Ventes</span>

            <div 
                className={`sidebar-item ${activeFilter === 'opportunite' ? 'active' : ''}`}
                onClick={() => onFilterChange('opportunite')}
            >
                <span className="item-icon" style={{ color: 'var(--accent-orange)' }}><TrendingUp size={16} /></span>
                Opportunités
            </div>
            
            <div 
                className={`sidebar-item ${activeFilter === 'client' ? 'active' : ''}`}
                onClick={() => onFilterChange('client')}
            >
                <span className="item-icon"><Users size={16} /></span>
                Clients
            </div>

            <div 
                className={`sidebar-item ${activeFilter === 'facture' ? 'active' : ''}`}
                onClick={() => onFilterChange('facture')}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="item-icon"><FileText size={16} /></span>
                    Factures
                </div>
                {stats.factures > 0 && <span className="item-count orange">{stats.factures}</span>}
            </div>

            <div 
                className={`sidebar-item ${activeFilter === 'newsletter' ? 'active' : ''}`}
                onClick={() => onFilterChange('newsletter')}
            >
                <span className="item-icon"><Star size={16} /></span>
                Newsletters
            </div>

            <span className="sidebar-section-label" style={{ marginTop: '1.25rem' }}>Classement</span>

            <div
                className={`sidebar-item ${activeFilter === 'treated' ? 'active' : ''}`}
                onClick={() => onFilterChange('treated')}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="item-icon" style={{ color: 'var(--accent-green)' }}><Check size={16} /></span>
                    Traites
                </div>
                {stats.traites > 0 && <span className="item-count green">{stats.traites}</span>}
            </div>

            <div 
                className={`sidebar-item ${activeFilter === 'archive' ? 'active' : ''}`}
                onClick={() => onFilterChange('archive')}
            >
                <span className="item-icon"><Archive size={16} /></span>
                Archivés
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button 
                  className="sidebar-sync-btn" 
                  onClick={onSync} 
                  disabled={isAutoPilotGearing || isSyncing}
                  title={isSyncing ? 'Synchronisation en cours' : 'Synchroniser les mails OVH'}
                >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Synchro...' : 'Sync OVH'}
                </button>
                <button 
                  className="crm-btn-primary" 
                  style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', border: 'none', padding: '0.6rem', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)' }} 
                  onClick={doAutoPilot}
                  disabled={isAutoPilotGearing}
                >
                    <Zap size={15} fill="currentColor" />
                    Auto-pilote IA
                </button>
            </div>
        </aside>
    );
}
