import React from 'react';
import { Search } from 'lucide-react';

export default function MailList({ mails, selectedMailId, onSelectMail, onSync, isSyncing, searchTerm, onSearch }) {

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d);
    };

    const getPriorityDot = (priorite) => {
        switch(priorite) {
            case 'urgent': return '🔴';
            case 'important': return '🟠';
            case 'normal': return '🔵';
            default: return '⚫';
        }
    };

    return (
        <div className="mail-list-panel">
            {/* SEARCH */}
            <div className="mail-list-header">
                <div className="mail-list-search">
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                    <Search className="search-icon" size={14} />
                </div>
                <div className="mail-list-count">{mails.length} messages</div>
            </div>

            {/* LIST */}
            <div className="mail-list-scroll">
                {mails.map(mail => {
                    // Extraction des initiales
                    let initial = "M";
                    if (mail.from_address) {
                        const match = mail.from_address.match(/^"?([^"<>@]+)/);
                        if (match && match[1]) {
                            initial = match[1].charAt(0).toUpperCase();
                        }
                    }

                    // Assombrir les logs "Archiver" 
                    const isIgnored = mail.action_recommandee === 'Ignorer' || mail.action_recommandee === 'Archiver';

                    return (
                        <div 
                            key={mail.id} 
                            className={`mail-card ${selectedMailId === mail.id ? 'selected' : ''} ${mail.status === 'a_repondre' ? 'unread' : ''}`}
                            onClick={() => onSelectMail(mail)}
                            style={{ opacity: isIgnored ? 0.6 : 1 }}
                        >
                            <div className="mail-card-top">
                                <div className="mail-avatar">{initial}</div>
                                <div className="mail-card-from">{mail.from_address}</div>
                                <div className="mail-card-date">{formatDate(mail.date_reception)}</div>
                            </div>

                            <div className="mail-card-subject" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span title={`Priorité: ${mail.priorite}`}>{getPriorityDot(mail.priorite)}</span>
                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mail.subject}</span>
                            </div>

                            <div className="mail-card-preview">
                                {mail.resume || "Contenu du message ignoré ou crypté."}
                            </div>

                            <div className="mail-card-tags">
                                {mail.is_business === 1 && (
                                    <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                        💰 Opportunité
                                    </span>
                                )}
                                {mail.action_recommandee === 'Répondre' && (
                                    <span className="badge badge-client">📝 À traiter</span>
                                )}
                                {mail.categorie === 'newsletters' && <span className="badge badge-normal">Newsletter</span>}
                                {mail.categorie === 'facture' && <span className="badge badge-facture">Facture</span>}
                                {mail.status === 'traite' && <span className="badge badge-traite">✓ Traité</span>}
                            </div>
                        </div>
                    );
                })}

                {mails.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Aucun message ne correspond.
                    </div>
                )}
            </div>
        </div>
    );
}
